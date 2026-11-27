// ============================================================================
// Rona Vision — rona-generate.js (Paket Mock, tanpa API key)
// -----------------------------------------------------------------------------
// File ini mendefinisikan generateContent() yang dipanggil tombol
// "Mulai Generate Konten AI Sekarang" di index.html.
//
// Cara pakai: letakkan file ini di root repo, lalu tambah tepat sebelum
// </body> di index.html:
//   <script src="rona-generate.js"></script>
//
// File ini TIDAK mengubah fungsi lain yang sudah ada di index.html.
// Fungsi-fungsi bantu (setDuration, selectModel, dll.) HANYA didefinisikan
// di sini kalau ternyata belum ada di index.html — karena di dalam teks
// index.html yang berhasil diambil dari GitHub, definisi fungsi-fungsi itu
// tidak ditemukan (hanya pemanggilan onclick-nya yang ada).
//
// Alur: baca prompt + pilihan studio -> POST /api/generate ->
// polling GET /api/jobs/:id tiap 5 detik -> isi #resultVideo saat COMPLETED.
// Dalam mode mock (MOCK_MODE=true di Cloudflare), video yang muncul adalah
// video contoh, BUKAN hasil AI asli. Selesai sekitar 20 detik.
// ============================================================================
(function () {
  'use strict';

  // --- State cadangan: dipakai hanya kalau variabel global index.html tidak ada.
  // Nilai awal mengikuti default yang tertera di index.html.
  var fallbackState = {
    model: 'Seedance 2.5',
    duration: '15s',
    resolution: '1080p',
    aspect: '16:9',
    mode: 'text-to-video'
  };

  // Baca variabel global index.html dengan aman (tanpa ReferenceError
  // kalau script inline index.html ternyata tidak jalan).
  function readGlobal(name, fallback) {
    try {
      var v = (typeof window !== 'undefined' && typeof window[name] !== 'undefined')
        ? window[name]
        : (typeof eval('typeof ' + name) !== 'undefined' && eval('typeof ' + name) !== 'undefined'
          ? eval(name)
          : undefined);
      return (v === undefined || v === null || v === '') ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  // Catatan: variabel global index.html dideklarasi dengan `let` di script
  // inline, jadi tidak menempel di window. readGlobal di atas mencoba
  // membacanya lewat eval typeof agar tetap aman kalau tidak ada.
  function getSelectedModel() {
    var m = readGlobal('selectedModel', null);
    if (m) return m;
    var active = document.querySelector('.model-card.border-purple-500 h4');
    if (active && active.textContent) return active.textContent.trim();
    return fallbackState.model;
  }

  function getSelectedDuration() {
    var d = readGlobal('selectedDuration', null);
    if (d) return d;
    var ids = ['dur-5s', 'dur-10s', 'dur-15s', 'dur-30s'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.className.indexOf('bg-purple-600') !== -1) {
        return el.textContent.trim();
      }
    }
    return fallbackState.duration;
  }

  function getSelectedResolution() {
    var r = readGlobal('selectedResolution', null);
    if (r) return r;
    var ids = ['res-480p', 'res-720p', 'res-1080p'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.className.indexOf('bg-purple-600') !== -1) {
        return el.textContent.trim();
      }
    }
    return fallbackState.resolution;
  }

  function getSelectedAspect() {
    var a = readGlobal('selectedAspect', null);
    if (a) return a;
    var ids = ['asp-169', 'asp-916', 'asp-11'];
    var vals = ['16:9', '9:16', '1:1'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.className.indexOf('bg-purple-600') !== -1) return vals[i];
    }
    return fallbackState.aspect;
  }

  function getCurrentMode() {
    var m = readGlobal('currentMode', null);
    if (m) return m;
    return fallbackState.mode;
  }

  function $(id) { return document.getElementById(id); }

  function setProgress(text, percent) {
    var t = $('progressText');
    var p = $('progressPercent');
    var b = $('progressBar');
    if (t) t.textContent = text;
    if (p) p.textContent = Math.round(percent) + '%';
    if (b) b.style.width = Math.round(percent) + '%';
  }

  // Perkiraan kredit, mengikuti hitungan backend (functions/_lib/models.js).
  // Dipakai hanya untuk memperbarui tampilan #creditCostText.
  function estimateCredits(modelKey, duration, resolution) {
    var base = { 'seedance-2.5': 24, 'seedance-2.0': 16, 'veo-3.1': 20, 'muse': 16 }[modelKey] || 16;
    var factor = { '480p': 0.6, '720p': 1, '1080p': 2.4 }[resolution] || 1;
    return Math.ceil(base * (duration / 10) * factor);
  }

  function updateCostText(modelKey, duration, resolution) {
    var el = $('creditCostText');
    if (el) el.textContent = '⚡ ' + estimateCredits(modelKey, duration, resolution) + ' Kredit';
  }

  function setActiveButton(groupIds, activeId) {
    groupIds.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var isActive = id === activeId;
      el.classList.toggle('bg-purple-600', isActive);
      el.classList.toggle('text-white', isActive);
      el.classList.toggle('bg-gray-800', !isActive);
    });
  }

  // --- Stub darurat: hanya dibuat kalau fungsi aslinya tidak ada di index.html.
  // Kalau fungsi aslinya ada, blok ini tidak melakukan apa-apa.
  if (typeof window.setDuration === 'undefined') {
    window.setDuration = function (v) {
      fallbackState.duration = v;
      setActiveButton(['dur-5s', 'dur-10s', 'dur-15s', 'dur-30s'], 'dur-' + v);
      var meta = $('previewMeta');
      if (meta) meta.textContent = v + ' • ' + getSelectedResolution() + ' • ' + getSelectedAspect();
    };
  }
  if (typeof window.setResolution === 'undefined') {
    window.setResolution = function (v) {
      fallbackState.resolution = v;
      setActiveButton(['res-480p', 'res-720p', 'res-1080p'], 'res-' + v);
      var meta = $('previewMeta');
      if (meta) meta.textContent = getSelectedDuration() + ' • ' + v + ' • ' + getSelectedAspect();
    };
  }
  if (typeof window.setAspect === 'undefined') {
    window.setAspect = function (v) {
      fallbackState.aspect = v;
      var map = { '16:9': 'asp-169', '9:16': 'asp-916', '1:1': 'asp-11' };
      setActiveButton(['asp-169', 'asp-916', 'asp-11'], map[v] || 'asp-169');
      var meta = $('previewMeta');
      if (meta) meta.textContent = getSelectedDuration() + ' • ' + getSelectedResolution() + ' • ' + v;
    };
  }
  if (typeof window.selectModel === 'undefined') {
    window.selectModel = function (v) {
      fallbackState.model = v;
      var cards = document.querySelectorAll('.model-card');
      cards.forEach(function (c) {
        var isActive = c.id === 'model-' + v;
        c.classList.toggle('border-purple-500', isActive);
        c.classList.toggle('border-gray-800', !isActive);
      });
    };
  }
  if (typeof window.setGeneratorMode === 'undefined') {
    window.setGeneratorMode = function (v) {
      fallbackState.mode = v;
      var map = { 'text-to-video': 'btnT2V', 'image-to-video': 'btnI2V', 'image-generator': 'btnImgGen' };
      ['btnT2V', 'btnI2V', 'btnImgGen'].forEach(function (id) {
        var el = $(id);
        if (!el) return;
        var isActive = id === map[v];
        el.classList.toggle('bg-purple-600', isActive);
        el.classList.toggle('text-white', isActive);
        el.classList.toggle('text-gray-400', !isActive);
      });
    };
  }
  if (typeof window.updateCharCount === 'undefined') {
    window.updateCharCount = function () {
      var input = $('promptInput');
      var cc = $('charCount');
      if (input && cc) cc.textContent = input.value.length + ' karakter';
    };
  }

  // --- Pemetaan nama model di UI -> model key backend.
  var MODEL_MAP = {
    'Seedance 2.5': 'seedance-2.5',
    'Seedance 2.0': 'seedance-2.0',
    'Veo 3.1 Pro': 'veo-3.1',
    'Veo 3.1': 'veo-3.1',
    'Muse': 'muse'
  };

  // Rencana segmen model Muse: 5=[5], 10=[10], 15=[10,5], 30=[10,10,10].
  function museSegments(duration) {
    if (duration === 5) return [5];
    if (duration === 10) return [10];
    if (duration === 15) return [10, 5];
    if (duration === 30) return [10, 10, 10];
    return [duration];
  }

  // Tambahkan kartu model Muse ke grid kalau belum ada di index.html.
  // index.html asli hanya punya 3 kartu (Seedance 2.5 / 2.0 / Veo 3.1 Pro).
  (function injectMuseCard() {
    try {
      var grid = document.getElementById('modelSelectionGrid');
      if (!grid || document.getElementById('model-Muse')) return;
      var card = document.createElement('div');
      card.id = 'model-Muse';
      card.className = 'model-card border-2 border-gray-800 bg-[#0b0f17] p-4 rounded-xl cursor-pointer transition hover:border-gray-600';
      card.setAttribute('onclick', "selectModel('Muse')");
      card.innerHTML = '<h4 class="font-bold text-white text-sm mb-1">Muse</h4><p class="text-[11px] text-gray-400">Buatan Muse • disambung per 10 detik</p>';
      grid.appendChild(card);
    } catch (e) { /* abaikan */ }
  })();

  var generating = false;

  // --- Upload foto referensi ke SERVER (baru) ---
  // Sebelumnya foto hanya tersimpan di browser (localStorage), jadi
  // browser lain tidak bisa melihatnya. Sekarang setiap File/Blob/data URL
  // di `uploadedImages` di-upload dulu ke POST /api/uploads (R2, fallback
  // KV untuk file kecil), dan id-nya dikirim ke /api/generate sebagai
  // reference_upload_id. Gallery juga membaca dari server (lihat
  // loadServerGallery di bawah), bukan dari localStorage saja.
  function dataUrlToBlob(dataUrl) {
    try {
      var m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      var bin = atob(m[2]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1] });
    } catch (e) { return null; }
  }

  function readUploadedImages() {
    try {
      var v = (typeof window !== 'undefined' && typeof window.uploadedImages !== 'undefined')
        ? window.uploadedImages : null;
      if (!v && typeof eval('typeof uploadedImages') !== 'undefined') { try { v = eval('uploadedImages'); } catch (e) {} }
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  async function uploadOneReference(item, index) {
    var form = new FormData();
    var name = 'foto-referensi-' + (index + 1) + '.jpg';
    if (item instanceof Blob) {
      form.append('file', item, item.name || name);
    } else if (typeof item === 'string' && item.indexOf('data:image') === 0) {
      var blob = dataUrlToBlob(item);
      if (!blob) return null;
      form.append('file', blob, name);
    } else if (item && typeof item === 'object' && (item.file instanceof Blob || item.blob instanceof Blob)) {
      var b = item.file || item.blob;
      form.append('file', b, b.name || item.name || name);
    } else if (item && typeof item === 'object' && typeof item.dataUrl === 'string') {
      var b2 = dataUrlToBlob(item.dataUrl);
      if (!b2) return null;
      form.append('file', b2, item.name || name);
    } else {
      return null; // URL http(s) atau bentuk lain: bukan file lokal, lewati.
    }
    var res = await fetch('/api/uploads', { method: 'POST', body: form });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Upload foto gagal (HTTP ' + res.status + ')'));
    return data; // { upload_id, url, name, size, storage }
  }

  async function uploadReferencePhotos() {
    var items = readUploadedImages();
    if (!items.length) return null;
    var first = null;
    for (var i = 0; i < items.length; i++) {
      try {
        var up = await uploadOneReference(items[i], i);
        if (up && !first) first = up;
      } catch (e) {
        // Satu foto gagal jangan gagalkan semuanya; error-nya dilaporkan
        // ke pemanggil lewat first.error.
        if (!first) first = { error: e.message };
      }
    }
    return first;
  }

  // --- Gallery dari SERVER (baru) ---
  // Ambil /api/gallery lalu render ke container Gallery kalau ketemu.
  // Defensif: struktur Gallery index.html tidak terverifikasi penuh, jadi
  // fungsi ini mencoba beberapa penanda umum, dan kalau tidak ketemu
  // tidak merusak halaman — datanya tetap tersedia di window.ronaGalleryData.
  window.ronaGalleryData = null;
  function findGalleryContainer() {
    var ids = ['galleryGrid', 'galleryList', 'galleryContainer', 'galleryItems', 'gallery'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) return el;
    }
    var marked = document.querySelector('[data-rona-gallery]');
    if (marked) return marked;
    // Cari pesan kosong Gallery yang diketahui: "Belum ada karya..."
    var all = document.querySelectorAll('div, section, main');
    for (var j = 0; j < all.length; j++) {
      if (all[j].textContent && all[j].textContent.indexOf('Belum ada karya') !== -1) {
        return all[j];
      }
    }
    return null;
  }

  window.ronaLoadServerGallery = async function loadServerGallery() {
    try {
      var res = await fetch('/api/gallery?limit=50');
      if (!res.ok) return null;
      var data = await res.json();
      window.ronaGalleryData = data;
      var container = findGalleryContainer();
      if (!container || !data.items) return data;
      if (!data.items.length) return data;
      var html = '';
      data.items.forEach(function (job) {
        var thumb = job.video_url
          ? '<video src="' + job.video_url + '" preload="metadata" style="width:100%;border-radius:12px;background:#000" controls></video>'
          : (job.reference_url
            ? '<img src="' + job.reference_url + '" style="width:100%;border-radius:12px" alt="Referensi">'
            : '');
        html += '<div style="background:#0b0f17;border:1px solid #1f2937;border-radius:16px;padding:12px;margin-bottom:12px">'
          + thumb
          + '<p style="color:#fff;font-weight:700;margin:8px 0 4px">' + String(job.prompt || '').slice(0, 80) + '</p>'
          + '<p style="color:#9ca3af;font-size:12px;margin:0">' + (job.duration || '?') + 's • ' + (job.resolution || '') + ' • ' + (job.aspect_ratio || '') + ' • ' + (job.status || '') + '</p>'
          + (job.video_url ? '<p style="margin:8px 0 0"><a href="' + job.video_url + '" target="_blank" style="color:#a855f7">Download / Buka video</a></p>' : '')
          + '</div>';
      });
      // Ganti isi container kosong dengan karya dari server.
      container.innerHTML = html;
      return data;
    } catch (e) { return null; }
  };

  // Muat Gallery server saat halaman selesai dimuat (best-effort).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.ronaLoadServerGallery(); });
  } else {
    window.ronaLoadServerGallery();
  }

  // --- Fungsi utama: dipanggil tombol "Mulai Generate Konten AI Sekarang".
  window.generateContent = async function generateContent() {
    if (generating) {
      alert('Generate masih berjalan. Tunggu sampai selesai dulu.');
      return;
    }

    var promptEl = $('promptInput');
    var prompt = promptEl ? promptEl.value.trim() : '';
    if (!prompt || prompt.length < 3) {
      alert('Isi Prompt / Deskripsi Adegan dulu (minimal 3 karakter).');
      if (promptEl) promptEl.focus();
      return;
    }

    var mode = getCurrentMode();
    if (mode === 'image-generator') {
      alert('Mode AI Image Generator belum didukung backend mock ini. Pilih Text to Video atau Image to Video.');
      return;
    }

    var modelLabel = getSelectedModel();
    var modelKey = MODEL_MAP[modelLabel] || 'seedance-2.5';
    var duration = parseInt(String(getSelectedDuration()).replace('s', ''), 10) || 15;
    var resolution = getSelectedResolution();
    var aspect = getSelectedAspect();

    // --- Penyesuaian batas model (backend akan menolak nilai di luar ini).
    var notes = [];
    if (modelKey === 'veo-3.1') {
      if (duration !== 4 && duration !== 6 && duration !== 8) {
        var clamped = duration <= 5 ? 4 : 8;
        notes.push('Veo 3.1 hanya bisa 4, 6, atau 8 detik, jadi durasi ' + duration + ' detik diubah menjadi ' + clamped + ' detik.');
        duration = clamped;
      }
      if (resolution === '480p') {
        notes.push('Veo 3.1 minimal 720p, jadi resolusi 480p diubah menjadi 720p.');
        resolution = '720p';
      }
      if (aspect === '1:1') {
        notes.push('Veo 3.1 hanya bisa 16:9 atau 9:16, jadi rasio 1:1 diubah menjadi 16:9.');
        aspect = '16:9';
      }
    }
    if (modelKey === 'seedance-2.0' && duration === 30) {
      notes.push('Seedance 2.0 maksimal 15 detik, jadi durasi 30 detik diubah menjadi 15 detik.');
      duration = 15;
    }
    if (notes.length) alert(notes.join('\n'));

    // Image-to-video: upload dulu foto referensi ke SERVER (/api/uploads),
    // supaya foto tersimpan di R2/KV dan bisa dilihat dari browser mana pun.
    // Sebelumnya foto hanya tersimpan lokal di browser, jadi browser lain
    // (termasuk browser saya) tidak bisa melihatnya.
    var imageUrl = null;
    var referenceUpload = null;
    if (mode === 'image-to-video') {
      try {
        var imgs = readUploadedImages();
        // Kalau ada URL http(s) yang valid, pakai itu langsung.
        for (var i = 0; i < imgs.length; i++) {
          var cand = typeof imgs[i] === 'string' ? imgs[i] : (imgs[i] && imgs[i].url);
          if (cand && /^https?:\/\//.test(cand)) { imageUrl = cand; break; }
        }
        if (!imageUrl) {
          setProgress('Mengunggah foto referensi ke server...', 3);
          referenceUpload = await uploadReferencePhotos();
          if (referenceUpload && referenceUpload.error) {
            alert('Foto referensi gagal tersimpan di server: ' + referenceUpload.error + '\nGenerate tetap jalan sebagai text-to-video, tapi fotonya tidak ikut tersimpan.');
            referenceUpload = null;
          }
        }
      } catch (e) {
        alert('Upload foto referensi gagal: ' + e.message + '\nGenerate tetap jalan sebagai text-to-video.');
        referenceUpload = null;
      }
    }

    var generateBtn = document.querySelector('button[onclick="generateContent()"]');
    generating = true;
    if (generateBtn) generateBtn.disabled = true;
    updateCostText(modelKey, duration, resolution);
    setProgress('Mengirim ke studio... (mode mock)', 5);

    var jobId = null;
    try {
      var res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          model: modelKey,
          duration: duration,
          resolution: resolution,
          aspect_ratio: aspect,
          ...(imageUrl ? { image_url: imageUrl } : {}),
          ...(referenceUpload ? { reference_upload_id: referenceUpload.upload_id, reference_url: referenceUpload.url, reference_name: referenceUpload.name } : {})
        })
      });
      var data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        if (res.status === 402) {
          alert('Kredit tidak cukup. ' + (data.error || 'Top up kredit dulu sebelum generate.'));
        } else if (res.status === 400) {
          alert('Generate ditolak backend: ' + (data.error || 'periksa prompt, model, durasi, dan resolusi.'));
        } else {
          alert('Generate gagal: ' + (data.error || ('HTTP ' + res.status)));
        }
        setProgress('Siap dibuat.', 0);
        generating = false;
        if (generateBtn) generateBtn.disabled = false;
        return;
      }

      jobId = data.job_id;
      if (data.credits_balance !== undefined) {
        try { currentUserCredits = data.credits_balance; } catch (e) { /* abaikan */ }
      }
      if (modelKey === 'muse' && data.segments) {
        setProgress('Model Muse — segmen: ' + data.segments.join(' + ') + ' detik. ' + (data.mock ? '(mode mock, selesai ~20 detik)' : 'Menunggu Muse membuat segmen di chat, lalu menggabungkannya.'), 10);
      } else {
        setProgress('Job ' + jobId + ' — antre... (' + (data.credits_cost || '?') + ' kredit)', 10);
      }

      // Polling tiap 5 detik. Mode mock selesai sekitar 20 detik.
      var startedAt = Date.now();
      var timer = setInterval(async function () {
        try {
          var r = await fetch('/api/jobs/' + encodeURIComponent(jobId));
          var job = await r.json().catch(function () { return {}; });
          if (!r.ok) throw new Error(job.error || ('HTTP ' + r.status));

          var elapsed = (Date.now() - startedAt) / 1000;
          if (job.status === 'COMPLETED' && job.video_url) {
            clearInterval(timer);
            showResult(job, prompt, duration, resolution, aspect);
            // Segarkan Gallery dari server supaya karya ini langsung
            // terlihat di browser lain, bukan hanya di browser ini.
            if (window.ronaLoadServerGallery) window.ronaLoadServerGallery();
            generating = false;
            if (generateBtn) generateBtn.disabled = false;
          } else if (job.status === 'FAILED') {
            clearInterval(timer);
            alert('Generate gagal' + (job.error ? ': ' + job.error : '. Kredit dikembalikan.') + (job.error ? '' : ''));
            setProgress('Gagal. Kredit dikembalikan.', 0);
            generating = false;
            if (generateBtn) generateBtn.disabled = false;
          } else if (job.status === 'WAITING_FOR_MUSE') {
            // Model Muse asli: job menunggu Muse di chat. Terus polling,
            // jangan timeout — Muse akan menyelesaikan lewat /api/muse-jobs/:id/complete.
            var segs = (job.segments || museSegments(duration)).join(' + ');
            setProgress('Menunggu Muse — segmen: ' + segs + ' detik. Cek chat Muse untuk progresnya.', 30);
          } else {
            // Progress semu selama menunggu (mock ~20 detik).
            var pct = Math.min(95, 10 + (elapsed / 20) * 85);
            setProgress('Status: ' + job.status + '... (mode mock, sekitar 20 detik)', pct);
          }
        } catch (err) {
          clearInterval(timer);
          alert('Tidak bisa mengecek status job: ' + err.message);
          setProgress('Gagal mengecek status.', 0);
          generating = false;
          if (generateBtn) generateBtn.disabled = false;
        }
      }, 5000);
    } catch (err) {
      alert('Tidak bisa terhubung ke backend (/api/generate). Pastikan functions/ sudah ter-deploy dan MOCK_MODE=true sudah diset di Cloudflare. Detail: ' + err.message);
      setProgress('Siap dibuat.', 0);
      generating = false;
      if (generateBtn) generateBtn.disabled = false;
    }
  };

  function showResult(job, prompt, duration, resolution, aspect) {
    var video = $('resultVideo');
    var img = $('resultImage');
    var placeholder = $('videoPlaceholder');
    if (img) img.classList.add('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    if (video) {
      video.src = job.video_url;
      video.classList.remove('hidden');
      video.load();
      video.play().catch(function () { /* biarkan user menekan play */ });
    }

    var title = $('previewTitle');
    if (title) title.textContent = prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt;
    var desc = $('previewDesc');
    if (desc) desc.textContent = prompt;
    var meta = $('previewMeta');
    if (meta) meta.textContent = duration + 's • ' + resolution + ' • ' + aspect;

    window.ronaLastVideoUrl = job.video_url;
    var dl = $('downloadBtn');
    if (dl) {
      dl.disabled = false;
      dl.classList.remove('bg-gray-800', 'text-gray-500', 'cursor-not-allowed');
      dl.classList.add('bg-purple-600', 'text-white');
      dl.onclick = function () { window.open(job.video_url, '_blank'); };
    }

    // Ambil sisa kredit terbaru dari backend untuk ditampilkan.
    fetch('/api/credits')
      .then(function (r) { return r.json(); })
      .then(function (c) {
        var balance = (c && typeof c.credits === 'number') ? c.credits : null;
        if (balance !== null) {
          try { currentUserCredits = balance; } catch (e) { /* abaikan */ }
          setProgress('Selesai (mode mock — video contoh, bukan hasil AI asli). Sisa kredit: ' + balance, 100);
        } else {
          setProgress('Selesai (mode mock — video contoh, bukan hasil AI asli).', 100);
        }
      })
      .catch(function () {
        setProgress('Selesai (mode mock — video contoh, bukan hasil AI asli).', 100);
      });
  }
})();
