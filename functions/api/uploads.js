// POST /api/uploads — upload foto referensi ke server.
// Terima multipart/form-data dengan field "file" (atau "image"),
// atau JSON { name, content_type, data } dengan data = data URL / base64.
// Foto disimpan di R2 (binding RONA_R2) kalau ada; kalau belum di-bind,
// file <= 1 MB disimpan sebagai data URL di KV (fallback tes saja).
// Batas: hanya image/*, maksimal 5 MB.
// Respon 201: { upload_id, url, name, size, storage: "r2" | "kv" }
// URL yang dikembalikan (/api/uploads/:id) bisa dibuka dari browser mana
// pun, karena file-nya di server — inilah yang membuat foto referensi
// tidak lagi hilang saat ganti browser.

import { saveUpload } from "../_lib/store.js";

const MAX_BYTES = 5 * 1024 * 1024;
const KV_FALLBACK_MAX = 1 * 1024 * 1024;

function cleanName(name) {
  return String(name || "foto.jpg").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "foto.jpg";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const contentType = request.headers.get("content-type") || "";
    let file = null;
    let name = "foto.jpg";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("file") || form.get("image");
      if (!file || typeof file === "string" || !file.size) {
        return Response.json({ error: "Tidak ada file. Kirim form-data dengan field 'file'." }, { status: 400 });
      }
      name = cleanName(file.name);
    } else {
      // JSON: { name, content_type, data } — data berupa data URL atau base64 murni.
      const body = await request.json().catch(() => ({}));
      if (!body.data) {
        return Response.json({ error: "Tidak ada file. Kirim form-data 'file' atau JSON { name, content_type, data }." }, { status: 400 });
      }
      const dataUrl = String(body.data);
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      const b64 = m ? m[2] : dataUrl;
      const mime = m ? m[1] : (body.content_type || "image/jpeg");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      file = new File([bytes], cleanName(body.name), { type: mime });
      name = cleanName(body.name);
    }

    if (!file.type || !file.type.startsWith("image/")) {
      return Response.json({ error: "File harus gambar (image/*)." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: `File terlalu besar (${Math.round(file.size / 1024 / 1024)} MB). Maksimal 5 MB.` }, { status: 413 });
    }

    const uploadId = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `uploads/${uploadId}-${name}`;
    const url = `/api/uploads/${uploadId}`;
    const created_at = new Date().toISOString();

    if (env.RONA_R2) {
      await env.RONA_R2.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      await saveUpload(env, {
        upload_id: uploadId, name, content_type: file.type, size: file.size,
        storage: "r2", r2_key: key, url, created_at,
      });
      return Response.json({ upload_id: uploadId, url, name, size: file.size, storage: "r2" }, { status: 201 });
    }

    // Fallback tanpa R2: hanya file kecil.
    if (file.size > KV_FALLBACK_MAX) {
      return Response.json(
        { error: "R2 (RONA_R2) belum di-bind di Cloudflare, dan file lebih dari 1 MB sehingga tidak bisa disimpan di KV. Bind bucket R2 dulu, lalu upload ulang." },
        { status: 500 }
      );
    }
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const data_url = `data:${file.type};base64,${btoa(binary)}`;
    await saveUpload(env, {
      upload_id: uploadId, name, content_type: file.type, size: file.size,
      storage: "kv", r2_key: null, data_url, url, created_at,
    });
    return Response.json({ upload_id: uploadId, url, name, size: file.size, storage: "kv" }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message || "Upload gagal." }, { status: 500 });
  }
}
