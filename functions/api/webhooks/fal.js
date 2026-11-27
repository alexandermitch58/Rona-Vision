// POST /api/webhooks/fal — webhook dari fal.ai saat job selesai.
// Body fal (queue webhook): { request_id, status, payload, ... }
// TODO: verifikasi signature webhook fal sebelum production.
// Cari job berdasarkan request_id dengan scan KV — untuk MVP ini disimpan
// juga dengan key request:<request_id> di generate.js tahap berikutnya.
// Versi ini: update job jika request_id dikirim bersama job_id di metadata,
// jika tidak, endpoint ini hanya mencatat dan status tetap bisa dicek via polling.

import { getJob, saveJob, refundCredits, archiveVideoToR2 } from "../../_lib/store.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const { request_id, status, payload } = body;

    // fal juga mengirim job_id di gateway_request_id / metadata pada beberapa setup.
    // Kalau tidak ada job_id, polling /api/jobs/:id tetap jadi sumber kebenaran.
    const jobId = body.job_id || body.metadata?.job_id;
    if (!jobId) {
      return Response.json({ ok: true, note: "Webhook diterima, tanpa job_id — polling tetap jalan." });
    }

    const job = await getJob(env, jobId);
    if (!job) return Response.json({ error: "Job tidak ditemukan." }, { status: 404 });

    if (status === "COMPLETED" || payload?.status === "COMPLETED") {
      job.status = "COMPLETED";
      job.video_url = payload?.data?.video?.url || payload?.video?.url || job.video_url;
      if (job.video_url) {
        const archived = await archiveVideoToR2(env, job.job_id, job.video_url);
        if (archived) {
          job.video_source_url = job.video_url;
          job.video_url = archived;
          job.video_archived = true;
        }
      }
      await saveJob(env, job);
    } else if (status === "FAILED") {
      job.status = "FAILED";
      job.error = payload?.error || "Generate gagal di provider.";
      await saveJob(env, job);
      await refundCredits(env, job.user_id, job.credits_cost);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
