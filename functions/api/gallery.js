// GET /api/gallery — daftar karya + foto referensi dari SERVER (KV/R2).
// ?limit=50 (default 50, maksimal 100)
// Respon: { items: [job publik terbaru dulu], reference_photos: [...] }
// Inilah yang membuat Gallery sama di semua browser: frontend tidak
// lagi membaca localStorage saja, tapi fetch endpoint ini saat halaman
// Gallery dibuka (lihat rona-generate.js: loadServerGallery()).

import { listGallery } from "../_lib/store.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const gallery = await listGallery(env, limit);
    return Response.json(gallery);
  } catch (e) {
    return Response.json({ error: e.message || "Gagal memuat Gallery." }, { status: 500 });
  }
}
