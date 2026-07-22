import { readFileSync } from 'fs';
import sharp from 'sharp';

async function main() {
  const items = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const moonStyle = items.find(i => i.title === 'Moon Style');
  
  const imgPath = moonStyle.images[1].replace('/uploads/', 'uploads/');
  console.log(`File: ${imgPath}`);
  
  const image = sharp(imgPath);
  const metadata = await image.metadata();
  console.log('Metadata:', JSON.stringify(metadata, null, 2));
  
  // Try with explicit RGBA conversion
  const buffer = await image.ensureAlpha().raw().toBuffer();
  console.log(`Buffer length: ${buffer.length}`);
  console.log(`Expected: ${metadata.width} * ${metadata.height} * 4 = ${metadata.width * metadata.height * 4}`);
  
  // Debug at origin
  console.log('\nTop-left 3x3 (RGBA):');
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const idx = (y * metadata.width + x) * 4;
      console.log(`  (${y},${x}): R=${buffer[idx]} G=${buffer[idx+1]} B=${buffer[idx+2]} A=${buffer[idx+3]}`);
    }
  }
  
  // Check bottom-right 3x3
  const w = metadata.width;
  const h = metadata.height;
  console.log(`\nBottom-right 3x3 (RGBA):`);
  for (let y = h - 3; y < h; y++) {
    for (let x = w - 3; x < w; x++) {
      const idx = (y * w + x) * 4;
      console.log(`  (${y},${x}): R=${buffer[idx]} G=${buffer[idx+1]} B=${buffer[idx+2]} A=${buffer[idx+3]}`);
    }
  }
  
  // Now check if right column and bottom row are white (using RGBA)
  const threshold = 240;
  
  // Right edge
  let rightWhite = 0;
  for (let y = 0; y < h; y++) {
    const idx = (y * w + (w - 1)) * 4;
    if (buffer[idx] >= threshold && buffer[idx+1] >= threshold && buffer[idx+2] >= threshold) {
      rightWhite++;
    }
  }
  console.log(`\nRight edge white pixels: ${rightWhite}/${h}`);
  
  // Bottom edge
  let bottomWhite = 0;
  for (let x = 0; x < w; x++) {
    const idx = ((h - 1) * w + x) * 4;
    if (buffer[idx] >= threshold && buffer[idx+1] >= threshold && buffer[idx+2] >= threshold) {
      bottomWhite++;
    }
  }
  console.log(`Bottom edge white pixels: ${bottomWhite}/${w}`);
}

main().catch(console.error);
