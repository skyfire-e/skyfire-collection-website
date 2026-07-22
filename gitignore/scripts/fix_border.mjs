import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

async function main() {
  const items = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const moonStyle = items.find(i => i.title === 'Moon Style');
  
  const imgPath = moonStyle.images[1].replace('/uploads/', 'uploads/');
  console.log(`Processing: ${imgPath}`);
  
  const meta = await sharp(imgPath).metadata();
  const { width: w, height: h, channels } = meta;
  console.log(`Dimensions: ${w}x${h}, channels: ${channels}, format: ${meta.format}`);
  
  const buffer = await sharp(imgPath).ensureAlpha().raw().toBuffer();
  const ch = 4; // RGBA after ensureAlpha
  
  const threshold = 250;
  
  // Find top
  let top = 0;
  for (let y = 0; y < h; y++) {
    let allWhite = true;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * ch;
      if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) {
        allWhite = false; break;
      }
    }
    if (!allWhite) break;
    top = y + 1;
  }
  
  // Find bottom
  let bottom = h - 1;
  for (let y = h - 1; y >= 0; y--) {
    let allWhite = true;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * ch;
      if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) {
        allWhite = false; break;
      }
    }
    if (!allWhite) break;
    bottom = y - 1;
  }
  
  // Find left
  let left = 0;
  for (let x = 0; x < w; x++) {
    let allWhite = true;
    for (let y = top; y <= bottom; y++) {
      const idx = (y * w + x) * ch;
      if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) {
        allWhite = false; break;
      }
    }
    if (!allWhite) break;
    left = x + 1;
  }
  
  // Find right
  let right = w - 1;
  for (let x = w - 1; x >= 0; x--) {
    let allWhite = true;
    for (let y = top; y <= bottom; y++) {
      const idx = (y * w + x) * ch;
      if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) {
        allWhite = false; break;
      }
    }
    if (!allWhite) break;
    right = x - 1;
  }
  
  console.log(`White border: top=${top}, bottom=${h - 1 - bottom}, left=${left}, right=${w - 1 - right}`);
  
  if (top > 0 || bottom < h - 1 || left > 0 || right < w - 1) {
    const newW = right - left + 1;
    const newH = bottom - top + 1;
    console.log(`Cropping to: ${newW}x${newH}`);
    
    // Extract the non-white area
    const cropped = await sharp(imgPath)
      .extract({ left, top, width: newW, height: newH })
      .jpeg({ quality: 95 })
      .toBuffer();
    
    writeFileSync(imgPath, cropped);
    console.log(`Fixed image saved as JPEG (${(cropped.length / 1024).toFixed(0)}KB)`);
  } else {
    console.log('No white border detected');
  }
}

main().catch(console.error);
