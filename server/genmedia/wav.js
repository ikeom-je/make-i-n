// Gemini TTS は環境によって生 PCM(audio/L16;rate=24000)で返すため、ブラウザで再生できる WAV に包む。

export function parsePcmMime(mime = '') {
  const m = /audio\/(L16|pcm)/i.exec(mime);
  if (!m) return null;
  const rate = Number(/rate=(\d+)/i.exec(mime)?.[1] ?? 24000);
  const channels = Number(/channels=(\d+)/i.exec(mime)?.[1] ?? 1);
  return { rate, channels, bits: 16 };
}

export function pcmToWav(pcm, { rate = 24000, channels = 1, bits = 16 } = {}) {
  const header = Buffer.alloc(44);
  const byteRate = (rate * channels * bits) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
