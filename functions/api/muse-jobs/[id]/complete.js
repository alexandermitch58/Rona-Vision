// POST /api/muse-jobs/:id/complete
// Dipanggil setelah Muse selesai membuat semua segmen dan menggabungkannya.
// Body: { video_url, error? }
// Auth: header x-muse-worker-secret harus sama dengan env.MUSE_WORKER_SECRET.
// Kalau secret belum diset di Cloudflare, endpoint ini menolak —
// set dulu secret itu, jangan biarkan tanpa auth di production.

import { getJob, saveJob, refundCredits } from "../../../_lib/store.js";

export async function onRequestPost(context) {
  const { env, params, request } = context;
  try {
    if (!env.MUSE_WORKER_SECRET) {
      return Response.json(
        { error: "MUSE_WORKER_SECRET belum diset di Cloudflare." },
        { status: 500 }
      );
    }
    const secret = request.headers.get("x-muse-worker-secret");
    if (secret !== env.MUSE_WORKER_SECRET) {
      return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
    const job = await getJob(env, params.id);
    if (!job) return Response.json({ error: "Job tidak ditemukan." }, { status: 404 });
    if (job.provider !== "muse") {
      return Response.json({ error: "Job ini bukan model Muse." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    if (body.error) {
      job.status = "FAILED";
      job.error = body.error;
      await saveJob(env, job);
      await refundCredits(env, job.user_id, job.credits_cost);
      return Response.json({ ok: true, status: "FAILED" });
    }
    if (!body.video_url) {
      return Response.json({ error: "video_url wajib diisi." }, { status: 400 });
    }
    job.status = "COMPLETED";
    job.video_url = body.video_url;
    if (job.segments) {
      job.segments = job.segments.map((s) => ({ ...s, status: "done" }));
    }
    await saveJob(env, job);
    return Response.json({ ok: true, status: "COMPLETED" });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
