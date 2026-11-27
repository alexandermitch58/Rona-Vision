// GET /api/uploads/:id — sajikan foto referensi yang tersimpan di server.
// Dari R2 kalau ada, kalau tidak dari data URL KV (fallback).
// Dipakai Gallery dan mode Image to Video di browser mana pun.

import { getUpload } from "../../_lib/store.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const upload = await getUpload(env, params.id);
    if (!upload) return Response.json({ error: "Foto tidak ditemukan." }, { status: 404 });

    if (upload.storage === "r2" && env.RONA_R2 && upload.r2_key) {
      const obj = await env.RONA_R2.get(upload.r2_key);
      if (!obj) return Response.json({ error: "File tidak ditemukan di R2." }, { status: 404 });
      return new Response(obj.body, {
        headers: {
          "Content-Type": upload.content_type || obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (upload.data_url) {
      const m = upload.data_url.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return Response.json({ error: "Data foto rusak." }, { status: 500 });
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      return new Response(bytes, {
        headers: {
          "Content-Type": m[1],
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    return Response.json({ error: "File tidak tersedia (R2 belum di-bind)." }, { status: 500 });
  } catch (e) {
    return Response.json({ error: e.message || "Gagal mengambil foto." }, { status: 500 });
  }
}
