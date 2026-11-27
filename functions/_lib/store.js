// Penyimpanan job + kredit di Cloudflare KV (binding RONA_KV).
// Kalau KV belum di-bind, fungsi akan error jelas supaya tidak diam-diam kehilangan data.

function kv(env) {
  if (!env.RONA_KV) throw new Error("KV RONA_KV belum di-bind di Cloudflare Pages.");
  return env.RONA_KV;
}

export async function getJob(env, jobId) {
  const raw = await kv(env).get(`job:${jobId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveJob(env, job) {
  await kv(env).put(`job:${job.job_id}`, JSON.stringify(job));
}

export async function listJobs(env, prefix = "job:") {
  const k = kv(env);
  const listed = await k.list({ prefix });
  const jobs = [];
  for (const item of listed.keys || []) {
    const raw = await k.get(item.name);
    if (raw) {
      try { jobs.push(JSON.parse(raw)); } catch (e) { /* abaikan */ }
    }
  }
  return jobs;
}

export async function getCredits(env, userId) {
  const raw = await kv(env).get(`credits:${userId}`);
  // Saldo awal admin 160, sesuai yang tampil di situs saat ini.
  // Tahap berikutnya ganti dengan saldo dari database user / pembelian paket.
  if (raw === null) return 160;
  return Number(raw);
}

export async function setCredits(env, userId, value) {
  await kv(env).put(`credits:${userId}`, String(value));
}

// Hold kredit saat submit, kembalikan kalau gagal, jadikan potongan final saat sukses.
// Disederhanakan untuk single-user (admin). Untuk multi-user, tambahkan transaksi
// dan tabel ledger di D1, jangan hanya mengandalkan KV.
export async function holdCredits(env, userId, amount) {
  const balance = await getCredits(env, userId);
  if (balance < amount) return { ok: false, balance };
  await setCredits(env, userId, balance - amount);
  return { ok: true, balance: balance - amount };
}

export async function refundCredits(env, userId, amount) {
  const balance = await getCredits(env, userId);
  await setCredits(env, userId, balance + amount);
  return balance + amount;
}

// --- Upload foto referensi + Gallery server ---
// Foto disimpan di R2 (binding RONA_R2) kalau ada; metadata-nya di KV
// dengan key upload:<id>. Kalau R2 belum di-bind, file kecil (<=1 MB)
// disimpan sebagai data URL di KV sebagai fallback, supaya alur tetap
// bisa dites — tapi itu bukan untuk produksi, karena KV dibatasi 25 MB.

export async function saveUpload(env, upload) {
  await kv(env).put(`upload:${upload.upload_id}`, JSON.stringify(upload));
}

export async function getUpload(env, uploadId) {
  const raw = await kv(env).get(`upload:${uploadId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function listUploads(env) {
  const k = kv(env);
  const listed = await k.list({ prefix: "upload:" });
  const out = [];
  for (const item of listed.keys || []) {
    const raw = await k.get(item.name);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        // Jangan kirim data_url (base64 besar) di daftar; cukup URL-nya.
        const { data_url, ...rest } = u;
        out.push(rest);
      } catch (e) { /* abaikan */ }
    }
  }
  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Bentuk job yang aman dikirim ke Gallery: hanya field publik,
// tanpa fal request_id / data internal lain.
export function publicJob(job) {
  if (!job) return null;
  return {
    job_id: job.job_id,
    prompt: job.prompt,
    model: job.model,
    provider: job.provider || null,
    duration: job.duration,
    resolution: job.resolution,
    aspect_ratio: job.aspect_ratio,
    status: job.status,
    video_url: job.video_url || null,
    video_archived: !!job.video_archived,
    reference_url: job.reference_url || job.image_url || null,
    reference_name: job.reference_name || null,
    reference_upload_id: job.reference_upload_id || null,
    credits_cost: job.credits_cost,
    created_at: job.created_at,
    segments: job.segments || null,
  };
}

// Gallery server: semua job terbaru dulu, plus daftar foto referensi.
// Dipakai GET /api/gallery — inilah yang membuat Gallery sama di
// semua browser, karena datanya dari KV/R2, bukan localStorage.
export async function listGallery(env, limit = 50) {
  const jobs = await listJobs(env);
  jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const items = jobs.slice(0, limit).map(publicJob);
  const reference_photos = await listUploads(env);
  return { items, reference_photos: reference_photos.slice(0, limit) };
}

// Arsipkan video final ke R2 (best-effort, jangan gagalkan job kalau gagal).
// Dipakai saat job COMPLETED dari fal / webhook: URL provider itu
// sementara dan bisa kedaluwarsa, sedangkan file di R2 permanen.
// Mengembalikan URL baru (/api/videos/:jobId) atau null kalau gagal /
// R2 belum di-bind.
export async function archiveVideoToR2(env, jobId, videoUrl) {
  if (!env.RONA_R2 || !videoUrl || !/^https?:\/\//.test(videoUrl)) return null;
  if (videoUrl.includes("/api/videos/")) return videoUrl;
  try {
    const res = await fetch(videoUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    const key = `videos/${jobId}.mp4`;
    await env.RONA_R2.put(key, buf, {
      httpMetadata: { contentType: "video/mp4" },
    });
    return `/api/videos/${jobId}`;
  } catch (e) {
    return null;
  }
}
