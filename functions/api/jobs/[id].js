// GET /api/jobs/:id — polling status dari frontend tiap 5 detik.
// Respon: { job_id, status, video_url, credits_cost }
// status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED

import { falStatus, falResult } from "../../_lib/fal.js";
import { getJob, saveJob, refundCredits, archiveVideoToR2 } from "../../_lib/store.js";

const MOCK_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const job = await getJob(env, params.id);
    if (!job) return Response.json({ error: "Job tidak ditemukan." }, { status: 404 });

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return Response.json(job);
    }

    // Mode mock: selesai setelah 20 detik.
    if (job.mock) {
      const ageMs = Date.now() - new Date(job.created_at).getTime();
      if (ageMs >= 20000) {
        job.status = "COMPLETED";
        job.video_url = MOCK_VIDEO_URL;
        if (job.segments) {
          job.segments = job.segments.map((s) => ({ ...s, status: "done" }));
        }
        await saveJob(env, job);
      }
      return Response.json(job);
    }

    // Model Muse (bukan mock): jangan panggil fal. Job menunggu Muse
    // di chat membuat segmen lalu menggabungkannya. Status hanya berubah
    // lewat endpoint /api/muse-jobs/:id/complete atau saat Muse
    // memperbarui job. Frontend menampilkan "Menunggu Muse...".
    if (job.provider === "muse") {
      return Response.json(job);
    }

    const statusData = await falStatus(env, job.fal_model, job.request_id);
    const status = statusData.status;

    if (status === "COMPLETED") {
      const result = await falResult(env, job.fal_model, job.request_id);
      job.status = "COMPLETED";
      job.video_url = result?.data?.video?.url || result?.video?.url || null;
      // Arsipkan video final ke R2 supaya Gallery tidak bergantung pada
      // URL provider yang sementara. Best-effort: kalau gagal, video_url
      // asli tetap dipakai.
      if (job.video_url) {
        const archived = await archiveVideoToR2(env, job.job_id, job.video_url);
        if (archived) {
          job.video_source_url = job.video_url;
          job.video_url = archived;
          job.video_archived = true;
        }
      }
      await saveJob(env, job);
    } else if (status === "FAILED" || status === "CANCELLED") {
      job.status = "FAILED";
      job.error = statusData.error || "Generate gagal di provider.";
      await saveJob(env, job);
      // Kembalikan hold kredit karena fal hanya menagih job sukses.
      await refundCredits(env, job.user_id, job.credits_cost);
    } else {
      job.status = status; // IN_QUEUE / IN_PROGRESS
      await saveJob(env, job);
    }

    return Response.json(job);
  } catch (e) {
    return Response.json({ error: e.message || "Cek status gagal." }, { status: 500 });
  }
}
