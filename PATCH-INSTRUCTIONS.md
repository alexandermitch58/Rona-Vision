# Rona Vision — Pasang Mode Mock (tanpa API key)

Paket ini membuat tombol **Generate** di Rona Vision benar-benar berfungsi
dalam mode percobaan, tanpa API key dan tanpa biaya. Video yang muncul
adalah **video contoh**, bukan hasil AI asli.

## Isi paket ini

| File / folder | Fungsi |
|---|---|
| `functions/` | Backend Cloudflare Pages Functions: `POST /api/generate`, `GET /api/jobs/:id`, `GET /api/credits`, `POST /api/webhooks/fal`, plus **baru**: `POST /api/uploads` + `GET /api/uploads/:id` (foto referensi ke R2), `GET /api/gallery` (karya + foto dari server), `GET /api/videos/:id` (video final yang diarsipkan ke R2). Disalin utuh dari `~/workspace/rona-vision-backend/`. |
| `rona-generate.js` | Mendefinisikan `generateContent()` yang dipanggil tombol Generate di `index.html`. Membaca prompt dan pilihan studio, **meng-upload dulu foto referensi ke `/api/uploads`**, mengirim `reference_upload_id` ke `/api/generate`, polling status tiap 5 detik, lalu menampilkan video di panel Preview (`#resultVideo`) dan **memuat Gallery dari `/api/gallery`** supaya karya terlihat di browser lain. |
| `.env.example` | Nilai environment untuk Cloudflare, dengan `MOCK_MODE=true`. |

## Catatan penting: TIDAK ada index.html ter-patch di paket ini

File `index.html` lengkap **tidak berhasil diambil secara utuh** dari GitHub
lewat browser: hasil ambilannya berakhir di tengah fungsi `addApiProvider`
(baris 1805) tanpa penutup `</script>`, `</body>`, dan `</html>`, dan
definisi fungsi `generateContent()`, `setDuration()`, `selectModel()`,
`setResolution()`, `setAspect()`, `downloadResult()`, serta
`updateCreditCost()` **tidak ditemukan** dalam teks yang berhasil diambil —
yang ada hanya pemanggilan `onclick="..."`-nya di HTML.

Karena itu saya **tidak membuat** file `index.html` hasil tambalan: file
tambalan dari salinan yang tidak utuh berisiko merusak situs. Yang disediakan
hanya `rona-generate.js` untuk ditambahkan ke `index.html` asli di repo.
`rona-generate.js` ditulis defensif untuk kondisi ini: ia membaca variabel
global (`selectedModel`, `selectedDuration`, dll.) kalau ada, kalau tidak
ada ia membaca status dari tombol/model yang aktif di halaman, dan ia
menyediakan fungsi `setDuration` / `selectModel` / `setResolution` /
`setAspect` / `setGeneratorMode` / `updateCharCount` **hanya kalau**
fungsi-fungsi itu belum ada.

Yang terverifikasi ada di `index.html` (dari hasil ambilan GitHub):
- `#promptInput` (textarea prompt), `#charCount`
- Tombol durasi `setDuration('5s'/'10s'/'15s'/'30s')`, id `dur-5s`, `dur-10s`, `dur-15s`, `dur-30s`
- Tombol resolusi `setResolution('480p'/'720p'/'1080p')`, id `res-480p`, `res-720p`, `res-1080p`
- Tombol rasio `setAspect('16:9'/'9:16'/'1:1')`, id `asp-169`, `asp-916`, `asp-11`
- Pilihan model `selectModel('Seedance 2.5' / 'Seedance 2.0' / 'Veo 3.1 Pro')`, id `model-Seedance 2.5` dll.
- `#creditCostBox` / `#creditCostText` (teks awal "⚡ 23 Kredit")
- Tombol Generate `onclick="generateContent()"` (tanpa id; file ini mencarinya lewat atribut onclick)
- Panel Preview: `#previewColumn`, `#videoPlaceholder`, `#resultVideo` (video, hidden), `#resultImage` (hidden), `#previewTitle`, `#previewDesc`, `#previewMeta`, `#progressText`, `#progressPercent`, `#progressBar`, `#downloadBtn` (disabled, `onclick="downloadResult()"`)
- Variabel global di script: `selectedDuration = '15s'`, `selectedResolution = '1080p'`, `selectedAspect = '16:9'`, `selectedModel = 'Seedance 2.5'`, `currentMode = 'text-to-video'`, `currentUserCredits = 160`
- Penyedia API default di kode: ToAPIs, endpoint `https://toapis.com/v1`, key kosong

Yang **tidak berhasil diverifikasi** (tidak ditemukan dalam teks yang diambil):
- Definisi `generateContent()`, `setDuration()`, `selectModel()`, `setResolution()`, `setAspect()`, `setGeneratorMode()`, `downloadResult()`, `updateCharCount()`, `updateCreditCost()` — hanya pemanggilannya yang terlihat. Kemungkinan definisi itu ada di bagian script yang hasil ambilannya terpotong / terkompres, atau memang tidak ada.
- Tidak ada elemen header ber-id khusus untuk menampilkan sisa kredit — sisa kredit hanya tampil di dalam modal akun (`openAccountModal('credits')`). Karena itu file ini menampilkan sisa kredit di `#progressText` setelah generate selesai.

## Langkah deploy mock

### 1. Salin file ke repo
Di repo `alexandermitch58/Rona-Vision` (saat ini isinya hanya `index.html`,
`bg.png`, folder `avatars/` dan `thumbs/`):
1. Salin folder `functions/` dari paket ini ke **root repo** (sejajar `index.html`).
2. Salin `rona-generate.js` ke **root repo**.
3. Jangan commit `.env.example` berisi key asli — file contoh di paket ini tidak berisi key.

### 2. Sambungkan script ke index.html
Buka `index.html` di repo, cari `</body>` paling akhir, dan tambahkan
tepat **sebelum** `</body>`:
```html
<script src="rona-generate.js"></script>
```
Jangan ubah baris lain. Satu baris itu saja.

### 3. Commit dan push
```bash
git add functions rona-generate.js index.html
git commit -m "Pasang backend mock: tombol Generate jalan tanpa API key"
git push origin main
```
Cloudflare Pages akan deploy otomatis dari branch `main`.

### 4. Atur environment di Cloudflare
Di [dashboard Cloudflare](https://dash.cloudflare.com/) > Pages > **rona-vision**:
1. **Settings > Environment variables**, tambahkan:
   - `MOCK_MODE` = `true`
   - Jangan isi `FAL_KEY` untuk mock.
2. **Settings > Functions > KV namespace bindings**, buat / pilih KV
   namespace lalu bind dengan nama variabel: `RONA_KV`.
   - Kalau belum ada KV: Workers & Pages > KV > Create namespace
     (misalnya namanya `rona-kv`), lalu bind ke project Pages ini.
   - Tanpa binding `RONA_KV`, endpoint akan error karena job dan kredit
     disimpan di KV.
3. **Settings > Functions > R2 bucket bindings**, buat / pilih bucket
   lalu bind dengan nama variabel: `RONA_R2`.
   - Kalau belum ada bucket: Workers & Pages > R2 object storage >
     Create bucket (misalnya namanya `rona-vision`), lalu bind ke
     project Pages ini.
   - Tanpa binding `RONA_R2`, foto referensi di atas 1 MB **tidak bisa**
     tersimpan (hanya file <= 1 MB yang disimpan di KV sebagai fallback),
     dan video final tetap memakai URL provider yang sementara.
     Untuk produksi, binding ini wajib.
4. **Deployments > Retry deployment** (atau push commit kosong) supaya
   environment baru terpakai.

### 5. Cara tes
1. Buka https://rona-vision.pages.dev/ dan login (akun demo yang ada di situs).
2. Buka tab **Studio**, isi Prompt, misalnya:
   `Hujan deras di atap rumah kayu saat malam, suara ASMR, kamera statis`
3. Pilih model, durasi, resolusi. Default: Seedance 2.5, 15 detik, 1080p.
4. Klik **✨ Mulai Generate Konten AI Sekarang**.
5. Tunggu sekitar **20 detik**. `#progressText` akan berubah
   `IN_QUEUE` → `IN_PROGRESS` → selesai. Video contoh muncul di panel
   Preview dan tombol Download aktif.
6. Cek sisa kredit: setelah selesai, `#progressText` menampilkan sisa
   kredit dari backend (`/api/credits`).
7. **Tes tersimpan lintas browser (yang kemarin bermasalah):**
   - Di browser pertama, upload foto referensi lalu klik Generate.
   - Buka `https://rona-vision.pages.dev/api/gallery` — harus muncul JSON
     dengan job kamu, `reference_url` berupa
     `https://rona-vision.pages.dev/api/uploads/...`, dan
     `reference_photos` berisi foto yang di-upload.
   - Buka situs dari **browser lain / HP lain**, masuk Gallery — karya
     dan foto referensi yang sama harus muncul, karena datanya dari
     server (KV + R2), bukan lagi dari localStorage browser pertama.
   - Kalau Gallery di browser kedua masih kosong, berarti deploy
     terbaru belum aktif atau `rona-generate.js` lama masih ter-cache:
     hard refresh (Ctrl+Shift+R) dan cek Deployments terbaru di
     Cloudflare berisi folder `functions/`.

### 6. Kalau gagal
- **"Tidak bisa terhubung ke backend (/api/generate)"** — `functions/`
  belum ter-deploy, atau deploy lama masih aktif. Cek di Cloudflare:
  Deployments terbaru harus berisi folder `functions/`.
- **Error `KV RONA_KV belum di-bind`** — binding KV belum dibuat
  (langkah 4 nomor 2).
- **Tombol durasi/model tidak merespons saat diklik** — script inline
  `index.html` kemungkinan memang tidak lengkap / terpotong. Generate
  tetap bisa jalan (file ini membaca pilihan dari tombol yang aktif),
  tapi perbaiki dulu `index.html` dari sumber aslinya sebelum lanjut.
- **Kredit tidak cukup (HTTP 402)** — saldo mock mulai dari 160 kredit
  dan berkurang tiap generate sesuai hitungan backend. Saldo tersimpan
  di KV, jadi tidak kembali ke 160 saat refresh.

## Batasan mode mock
- Video yang muncul adalah **video contoh publik** (Big Buck Bunny),
  bukan video yang dibuat dari prompt kamu. Prompt tetap dikirim dan
  dicatat di job, tapi tidak diproses AI.
- Kredit tetap dipotong sesuai hitungan backend supaya alur kredit
  bisa dites.
- Login, daftar user, dan top-up di situs masih simulasi front-end
  (tersimpan di browser) — belum terhubung ke backend ini.
- Mode `AI Image Generator` belum didukung paket ini: kalau dipilih,
  akan muncul peringatan dan generate dibatalkan. Pilih Text to Video
  atau Image to Video.
- **Yang sudah diperbaiki di update ini:** foto referensi dan Gallery
  kini tersimpan di server (R2 + KV), bukan lagi di localStorage.
  Video final mode nyata juga diarsipkan ke R2 saat job COMPLETED
  (best-effort), supaya URL-nya tidak kedaluwarsa seperti URL provider.
  Di mode mock, video contoh tetap memakai URL publik, jadi tidak
  diarsipkan.

## Beralih ke video asli (nanti)
1. Daftar di fal.ai, top-up saldo, buat API key.
2. Di Cloudflare, set secret `FAL_KEY` = key fal.ai (jangan tulis di chat
   biasa dan jangan commit ke repo), dan ubah `MOCK_MODE` menjadi `false`.
3. Redeploy. Tidak perlu mengubah `index.html` atau `rona-generate.js`.
4. Tes 1 video murah dulu: Seedance 2.0 Fast, 5 detik, 480p.
5. Catatan: Veo 3.1 di backend hanya bisa 4, 6, atau 8 detik —
   `rona-generate.js` otomatis menurunkan durasi 5/10/15/30 detik
   menjadi 4/8 detik dan memberi tahu lewat alert.
