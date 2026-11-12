// Split a long MP3 into independently decodable files, each < 50 MB.
// Supabase Free rejects final objects above 50 MB even when using TUS chunks.
// Cuts are aligned with validated MPEG Layer III frame headers. No transcoding,
// and no full-file ArrayBuffer allocation is needed for a 128 MB song.
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const PART_BYTES = 44 * 1024 * 1024;
const SEARCH_BYTES = 512 * 1024;

function mp3FrameSize(data, i) {
  if (i + 4 > data.length) return 0;
  const a = data[i], b = data[i + 1], c = data[i + 2];
  if (a !== 0xff || (b & 0xe0) !== 0xe0) return 0;
  const version = (b >> 3) & 3;
  const layer = (b >> 1) & 3;
  const bitrateIndex = (c >> 4) & 15;
  const rateIndex = (c >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 ||
      bitrateIndex === 15 || rateIndex === 3) return 0;
  const rates = [44100, 48000, 32000];
  const baseRate = rates[rateIndex];
  const sampleRate = version === 3 ? baseRate : version === 2 ? baseRate / 2 : baseRate / 4;
  const mpeg1Bitrates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
  const mpeg2Bitrates = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0];
  const kbps = (version === 3 ? mpeg1Bitrates : mpeg2Bitrates)[bitrateIndex];
  const padding = (c >> 1) & 1;
  return Math.floor((version === 3 ? 144000 : 72000) * kbps / sampleRate) + padding;
}

async function findNextFrame(file, approximate) {
  const bytes = new Uint8Array(await file.slice(approximate, Math.min(file.size, approximate + SEARCH_BYTES)).arrayBuffer());
  for (let i = 0; i < bytes.length - 2048; i++) {
    const size = mp3FrameSize(bytes, i);
    if (size < 24) continue;
    const nextSize = mp3FrameSize(bytes, i + size);
    if (nextSize < 24) continue;
    // Compare MPEG version, layer and sample rate across consecutive frames.
    if ((bytes[i + 1] & 0x1e) !== (bytes[i + size + 1] & 0x1e)) continue;
    if ((bytes[i + 2] & 0x0c) !== (bytes[i + size + 2] & 0x0c)) continue;
    return approximate + i;
  }
  throw new Error('Nu am putut identifica limita unui cadru MP3. Reexportă fișierul în MP3 (CBR sau VBR standard).');
}

export async function splitMp3ForFreeStorage(file) {
  if (!file || file.size <= 0) throw new Error('Alege un fișier MP3.');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Limita audio este de 200 MB.');
  if (file.size <= PART_BYTES) return [file];

  const pieces = [];
  let start = 0;
  while (file.size - start > PART_BYTES) {
    const at = await findNextFrame(file, start + PART_BYTES);
    if (at <= start || at - start > 49 * 1024 * 1024) {
      throw new Error('Nu s-a putut împărți fișierul MP3 sub limita Supabase Free.');
    }
    pieces.push(file.slice(start, at, 'audio/mpeg'));
    start = at;
  }
  pieces.push(file.slice(start, file.size, 'audio/mpeg'));
  return pieces;
}
