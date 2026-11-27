// POST /api/generate
// Body: { prompt, model, duration, resolution, aspect_ratio, image_url?, reference_upload_id?, reference_url?, reference_name? }
// reference_upload_id: id dari POST /api/uploads — foto referensi yang
// sudah tersimpan di server (R2/KV), jadi job + Gallery bisa dilihat dari
// browser mana pun. image_url lama tetap didukung.
// Respon langsung: { job_id, status: "queued", credits_cost, credits_balance }
// JANGAN menunggu video selesai di request ini — frontend polling ke /api/jobs/:id.

import { MODELS, calculateCredits, validateRequest, getSegments } from "../_lib/models.js";
import { falSubmit } from "../_lib/fal.js";
import { getCredits, holdCredits, saveJob, getUpload } from "../_lib/store.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));

    const err = validateRequest(body);
    if (err) {
      return Response.json({ error: err }, { status: 400 });
    }

    const { prompt, model, duration, resolution, aspect_ratio, image_url } = body;
    const m = MODELS[model];
    const cost = calculateCredits(model, Number(duration), resolution);

    // Foto referensi yang sudah di-upload ke server lewat POST /api/uploads.
    // reference_upload_id -> URL server (/api/uploads/:id) yang bisa dibuka
    // dari browser mana pun. Untuk fal (provider luar), URL harus absolut.
    const origin = new URL(request.url).origin;
    const toAbsolute = (u) => (u && u.startsWith("/") ? origin + u : u);
    let reference_upload_id = body.reference_upload_id || null;
    let reference_url = body.reference_url ? toAbsolute(body.reference_url) : null;
    let reference_name = body.reference_name || null;
    if (reference_upload_id) {
      const up = await getUpload(env, reference_upload_id);
      if (!up) {
        return Response.json({ error: "Foto referensi tidak ditemukan di server. Upload ulang lewat /api/uploads." }, { status: 400 });
      }
      reference_url = origin + up.url;
      reference_name = up.name;
    }
    const effectiveImageUrl = reference_url || (image_url ? toAbsolute(image_url) : null);

    // TODO auth: saat ini single-user (admin), karena penggunanya baru kamu saja.
    // Sebelum dibuka untuk umum, ganti userId dengan id dari session/JWT.
    const userId = "admin";
    const balance = await getCredits(env, userId);
    if (balance < cost) {
      return Response.json(
        { error: `Kredit tidak cukup. Butuh ${cost} kredit, sisa ${balance} kredit.` },
        { status: 402 }
      );
    }

    const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const isMock = env.MOCK_MODE === "true" || !env.FAL_KEY;

    // --- Model Muse: tidak lewat fal, tidak butuh FAL_KEY. ---
    // Job masuk antrean Muse. Muse di chat membuat tiap segmen
    // (maks 10 detik per segmen) lalu menggabungkannya dengan ffmpeg.
    // Di mode mock, job Muse selesai ~20 detik dengan video contoh,
    // supaya alur UI bisa dites tanpa menunggu Muse.
    if (model === "muse") {
      const segments = getSegments(model, Number(duration));
      await holdCredits(env, userId, cost);
      await saveJob(env, {
        job_id: jobId,
        user_id: userId,
        model,
        provider: "muse",
        prompt,
        duration: Number(duration),
        resolution,
        aspect_ratio: aspect_ratio || "16:9",
        reference_upload_id,
        reference_url,
        reference_name,
        image_url: effectiveImageUrl,
        credits_cost: cost,
        status: isMock ? "IN_PROGRESS" : "WAITING_FOR_MUSE",
        segments: segments.map((d, i) => ({
          index: i,
          duration: d,
          status: "pending",
          video_url: null,
        })),
        mock: isMock,
        created_at: new Date().toISOString(),
        video_url: null,
      });
      return Response.json({
        job_id: jobId,
        status: isMock ? "IN_PROGRESS" : "WAITING_FOR_MUSE",
        provider: "muse",
        segments,
        mock: isMock,
        credits_cost: cost,
        credits_balance: balance - cost,
        note: isMock
          ? "Mode mock Muse: job selesai ~20 detik dengan video contoh."
          : "Job Muse masuk antrean. Muse akan membuat segmen " + segments.join(" + ") + " detik di chat, lalu menggabungkannya. Cek status job ini di chat Muse.",
      });
    }

    if (isMock) {
      await holdCredits(env, userId, cost);
      await saveJob(env, {
        job_id: jobId,
        user_id: userId,
        model,
        prompt,
        duration: Number(duration),
        resolution,
        aspect_ratio: aspect_ratio || "16:9",
        reference_upload_id,
        reference_url,
        reference_name,
        image_url: effectiveImageUrl,
        credits_cost: cost,
        status: "IN_PROGRESS",
        mock: true,
        created_at: new Date().toISOString(),
        video_url: null,
      });
      return Response.json({
        job_id: jobId,
        status: "IN_PROGRESS",
        mock: true,
        credits_cost: cost,
        credits_balance: balance - cost,
        note: "Mode mock: tidak memanggil fal, tidak ada biaya. Job selesai ~20 detik.",
      });
    }

    // Mode nyata: submit ke fal Queue, jangan tunggu selesai.
    const falModel = effectiveImageUrl ? m.falImage : m.falText;
    const input = {
      prompt: prompt.trim(),
      resolution,
      duration: Number(duration),
      aspect_ratio: aspect_ratio || "16:9",
      generate_audio: true,
      ...(effectiveImageUrl ? { image_url: effectiveImageUrl } : {}),
    };

    const submitted = await falSubmit(env, falModel, input, env.FAL_WEBHOOK_URL || undefined);

    await holdCredits(env, userId, cost);
    await saveJob(env, {
      job_id: jobId,
      user_id: userId,
      model,
      fal_model: falModel,
      request_id: submitted.request_id,
      prompt,
      duration: Number(duration),
      resolution,
      aspect_ratio: aspect_ratio || "16:9",
      reference_upload_id,
      reference_url,
      reference_name,
      image_url: effectiveImageUrl,
      credits_cost: cost,
      status: "IN_QUEUE",
      created_at: new Date().toISOString(),
      video_url: null,
    });

    return Response.json({
      job_id: jobId,
      status: "IN_QUEUE",
      credits_cost: cost,
      credits_balance: balance - cost,
    });
  } catch (e) {
    return Response.json({ error: e.message || "Generate gagal." }, { status: 500 });
  }
}
