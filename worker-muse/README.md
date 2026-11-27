# Worker Muse — cara memproses job model Muse

Model `muse` di Rona Vision **tidak** memanggil fal.ai dan tidak butuh
`FAL_KEY`. Alurnya adalah antrean:

```
Situs: pilih model Muse -> POST /api/generate
  -> job tersimpan di KV, status WAITING_FOR_MUSE
  -> segmen: 5=[5], 10=[10], 15=[10,5], 30=[10,10,10]
Muse di chat:
  -> GET /api/muse-queue (dengan header x-muse-worker-secret)
  -> ambil job tertua
  -> buat tiap segmen dengan media.generate_video
  -> gabung segmen dengan ffmpeg (stitch.sh)
  -> upload video final ke R2 / hosting file
  -> POST /api/muse-jobs/:id/complete { video_url }
Situs: polling GET /api/jobs/:id -> COMPLETED -> video tampil di Preview
```

## 1. Ambil antrean

```bash
curl https://rona-vision.pages.dev/api/muse-queue \
  -H "x-muse-worker-secret: $MUSE_WORKER_SECRET"
```

## 2. Buat segmen di chat Muse

Untuk tiap segmen, buat video dengan prompt yang sama ditambah
penanda kelanjutan, supaya sambungannya tidak patah:

- Segmen 1 (10 detik): `{prompt}. Bagian 1 dari 2, durasi 10 detik, adegan pembuka.`
- Segmen 2 (5 detik): `{prompt}. Bagian 2 dari 2, durasi 5 detik, lanjutkan langsung adegan sebelumnya dengan kamera, cahaya, dan suasana yang sama, tanpa mengulang pembuka.`

Maksimal 6 video per pesan chat Muse, jadi satu job 30 detik
(3 segmen) masih muat dalam satu pesan. Kalau antrean ada banyak job,
proses satu job per pesan.

Catatan jujur: alat video Muse tidak menjamin durasi persis seperti
yang diminta di prompt. Hasil tiap segmen bisa sedikit lebih pendek
atau panjang. Karena itu saat stitch, potong tiap segmen ke durasi
target dengan `-t` (lihat stitch.sh) supaya totalnya mendekati
5 / 10 / 15 / 30 detik yang dipilih user.

## 3. Gabung segmen

```bash
./stitch.sh seg1.mp4 seg2.mp4 hasil-akhir.mp4
# 15 detik: ./stitch.sh seg10.mp4 seg5.mp4 hasil-15s.mp4
# 30 detik: ./stitch.sh seg10a.mp4 seg10b.mp4 seg10c.mp4 hasil-30s.mp4
```

`stitch.sh` mencoba gabung tanpa re-encode dulu (`-c copy`, cepat),
kalau codec-nya beda ia otomatis re-encode dengan filter concat.
Tes lokal 27 Nov 2026: segmen 10 detik + 5 detik (testsrc) berhasil
digabung menjadi 15,02 detik.

## 4. Selesaikan job

Upload `hasil-akhir.mp4` ke R2 / hosting file dulu sampai dapat URL
publik, lalu:

```bash
curl -X POST https://rona-vision.pages.dev/api/muse-jobs/<job_id>/complete \
  -H "x-muse-worker-secret: $MUSE_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://.../hasil-akhir.mp4"}'
```

Kalau gagal, kirim `{"error": "alasan gagal"}` supaya kredit
dikembalikan ke user.

## Secret yang dibutuhkan di Cloudflare

- `MUSE_WORKER_SECRET` — string acak panjang, dipakai untuk
  `GET /api/muse-queue` dan `POST /api/muse-jobs/:id/complete`.
  Jangan tulis nilainya di repo atau di chat biasa.
- `RONA_KV` — binding KV untuk job dan kredit (sudah ada).
- `MOCK_MODE` — `true` untuk tes mock, `false` untuk antrean Muse asli.
  Model Muse tetap jalan di `MOCK_MODE=false` tanpa `FAL_KEY`.
