// GET /api/muse-queue — daftar job model Muse yang menunggu diproses.
// Dipakai Muse di chat untuk melihat antrean: prompt, durasi, segmen.
// Lindungi dengan secret sederhana saat dibuka untuk umum:
// kirim header x-muse-worker-secret sama dengan env.MUSE_WORKER_SECRET.
// Untuk single-user (admin saja), endpoint ini masih terbuka —
// jangan umumkan URL ini sebelum auth dibangun.

import { listJobs } from "../_lib/store.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    if (env.MUSE_WORKER_SECRET) {
      const secret = request.headers.get("x-muse-worker-secret");
      if (secret !== env.MUSE_WORKER_SECRET) {
        return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
      }
    }
    const jobs = await listJobs(env);
    const waiting = jobs
      .filter((j) => j.provider === "muse" && j.status === "WAITING_FOR_MUSE")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((j) => ({
        job_id: j.job_id,
        prompt: j.prompt,
        duration: j.duration,
        segments: j.segments,
        resolution: j.resolution,
        aspect_ratio: j.aspect_ratio,
        credits_cost: j.credits_cost,
        created_at: j.created_at,
      }));
    return Response.json({ jobs: waiting });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
