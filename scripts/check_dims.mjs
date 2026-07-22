import { readFileSync } from 'fs';

for (let i = 1; i <= 20; i++) {
  const data = readFileSync(`uploads/stone-dice-${i}.jpg`);
  
  // Parse JPEG dimensions from the file header
  function getJpegSize(buf) {
    let offset = 0;
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
    offset += 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xFF) return null;
      const marker = buf[offset + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const h = (buf[offset + 5] << 8) + buf[offset + 6];
        const w = (buf[offset + 7] << 8) + buf[offset + 8];
        return { width: w, height: h };
      }
      const len = (buf[offset + 2] << 8) + buf[offset + 3];
      offset += 2 + len;
    }
    return null;
  }
  
  const size = getJpegSize(data);
  const kb = (data.length / 1024).toFixed(0);
  console.log(`stone-dice-${i}.jpg: ${kb}KB ${size ? size.width + 'x' + size.height : 'unknown'}`);
}
