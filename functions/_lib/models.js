// Mapping model Rona Vision -> fal.ai
// Sumber riset 27 Nov 2026. Verifikasi ulang ID model di fal.ai sebelum launch,
// terutama varian image-to-video Veo 3.1 dan Seedance 2.5 Flash.

export const MODELS = {
  "seedance-2.0": {
    label: "Seedance 2.0",
    falText: "bytedance/seedance-2.0/text-to-video",
    falImage: "bytedance/seedance-2.0/image-to-video",
    durations: [5, 10, 15],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["16:9", "9:16", "1:1"],
    baseCreditsPer10s720p: 16,
  },
  "seedance-2.0-fast": {
    label: "Seedance 2.0 Fast",
    falText: "bytedance/seedance-2.0/fast/text-to-video",
    falImage: "bytedance/seedance-2.0/fast/image-to-video",
    durations: [5, 10, 15],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["16:9", "9:16", "1:1"],
    baseCreditsPer10s720p: 13,
  },
  "seedance-2.5": {
    label: "Seedance 2.5",
    falText: "bytedance/seedance-2.5/text-to-video",
    falImage: "bytedance/seedance-2.5/image-to-video",
    durations: [5, 10, 15, 30],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    baseCreditsPer10s720p: 24,
  },
  "veo-3.1": {
    label: "Veo 3.1",
    // Bukan "Veo 3.1 Pro" — nama itu tidak ada resminya.
    // Veo di fal hanya 4, 6, atau 8 detik.
    falText: "fal-ai/veo3.1",
    falImage: "fal-ai/veo3.1",
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    ratios: ["16:9", "9:16"],
    baseCreditsPer10s720p: 20,
  },
  "muse": {
    label: "Muse",
    // Model Muse: BUKAN lewat fal.ai dan BUKAN lewat API key.
    // Video dibuat oleh Muse di chat (media.generate_video), per segmen
    // maksimal 10 detik, lalu segmen-segmen digabung dengan ffmpeg.
    // Rencana segmen (sesuai permintaan pemilik):
    //   5 detik  -> [5]
    //   10 detik -> [10]
    //   15 detik -> [10, 5]
    //   30 detik -> [10, 10, 10]
    provider: "muse",
    durations: [5, 10, 15, 30],
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["16:9", "9:16", "1:1"],
    baseCreditsPer10s720p: 16,
  },
};

// Rencana segmen untuk satu job. Untuk model fal, satu segmen = durasi penuh.
// Untuk Muse, pecah sesuai aturan di atas karena satu generate Muse
// maksimal 10 detik.
export function getSegments(modelKey, duration) {
  const d = Number(duration);
  if (modelKey === "muse") {
    if (d === 5) return [5];
    if (d === 10) return [10];
    if (d === 15) return [10, 5];
    if (d === 30) return [10, 10, 10];
    throw new Error("Durasi Muse tidak didukung: " + d + ". Pilih 5, 10, 15, atau 30 detik.");
  }
  return [d];
}

const RESOLUTION_FACTOR = { "480p": 0.6, "720p": 1, "1080p": 2.4 };

export function calculateCredits(modelKey, duration, resolution) {
  const m = MODELS[modelKey];
  if (!m) throw new Error("Model tidak dikenal: " + modelKey);
  const factor = RESOLUTION_FACTOR[resolution] ?? 1;
  return Math.ceil(m.baseCreditsPer10s720p * (duration / 10) * factor);
}

export function validateRequest(body) {
  const { prompt, model, duration, resolution, aspect_ratio } = body || {};
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return "Prompt wajib diisi (minimal 3 karakter).";
  }
  if (prompt.length > 2000) return "Prompt terlalu panjang (maks 2000 karakter).";
  const m = MODELS[model];
  if (!m) return "Model tidak dikenal. Pilih: " + Object.keys(MODELS).join(", ");
  // Jangan percaya duration dari frontend. Tolak nilai di luar daftar.
  if (!m.durations.includes(Number(duration))) {
    return `Durasi ${duration} detik tidak didukung ${m.label}. Pilih: ${m.durations.join(", ")} detik.`;
  }
  if (!m.resolutions.includes(resolution)) {
    return `Resolusi ${resolution} tidak didukung ${m.label}. Pilih: ${m.resolutions.join(", ")}.`;
  }
  if (aspect_ratio && !m.ratios.includes(aspect_ratio)) {
    return `Rasio ${aspect_ratio} tidak didukung ${m.label}. Pilih: ${m.ratios.join(", ")}.`;
  }
  return null;
}
