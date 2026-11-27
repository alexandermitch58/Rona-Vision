// GET /api/videos/:id — sajikan video final yang diarsipkan ke R2.
// Key R2: videos/<jobId>.mp4, ditulis oleh archiveVideoToR2() saat job
// COMPLETED (dipanggil dari /api/jobs/:id dan webhook fal).
// Kalau belum diarsipkan / R2 belum di-bind: 404 — frontend tetap pakai
// video_url asli dari provider.

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    if (!env.RONA_R2) return Response.json({ error: "R2 belum di-bind." }, { status: 404 });
    const obj = await env.RONA_R2.get(`videos/${params.id}.mp4`);
    if (!obj) return Response.json({ error: "Video belum diarsipkan." }, { status: 404 });
    return new Response(obj.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || "Gagal mengambil video." }, { status: 500 });
  }
}
