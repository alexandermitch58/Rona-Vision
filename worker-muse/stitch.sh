#!/bin/bash
# Gabung segmen video Muse menjadi satu video.
# Pemakaian: ./stitch.sh seg1.mp4 seg2.mp4 [seg3.mp4 ...] output.mp4
# Contoh 15 detik: ./stitch.sh seg10.mp4 seg5.mp4 hasil-15s.mp4
# Contoh 30 detik: ./stitch.sh seg10a.mp4 seg10b.mp4 seg10c.mp4 hasil-30s.mp4
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Pakai: $0 seg1.mp4 seg2.mp4 [seg3.mp4 ...] output.mp4" >&2
  exit 1
fi

OUTPUT="${@: -1}"
INPUTS=("${@:1:$#-1}")

LIST_FILE="$(mktemp)"
trap 'rm -f "$LIST_FILE"' EXIT
for f in "${INPUTS[@]}"; do
  # ffmpeg concat butuh path absolut atau relatif yang aman
  echo "file '$(realpath "$f")'" >> "$LIST_FILE"
done

# Coba gabung cepat tanpa re-encode dulu. Kalau gagal (codec beda),
# jatuh ke re-encode dengan filter concat.
if ffmpeg -y -v error -f concat -safe 0 -i "$LIST_FILE" -c copy "$OUTPUT"; then
  echo "Selesai (copy): $OUTPUT"
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT"
  exit 0
fi

echo "Copy gagal, coba re-encode..." >&2
N=${#INPUTS[@]}
FILTER=""
for ((i=0; i<N; i++)); do
  FILTER+="[$i:v:0][$i:a:0]"
done
FILTER+="concat=n=${N}:v=1:a=1[outv][outa]"
INPUT_ARGS=()
for f in "${INPUTS[@]}"; do INPUT_ARGS+=(-i "$f"); done
ffmpeg -y -v error "${INPUT_ARGS[@]}" -filter_complex "$FILTER" -map "[outv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -c:a aac "$OUTPUT"
echo "Selesai (re-encode): $OUTPUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT"
