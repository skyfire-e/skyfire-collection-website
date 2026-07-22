import { readFileSync } from 'fs';
import { Jimp, intToRGBA } from 'jimp';

async function analyzeWhiteBorder(imagePath) {
  const image = await Jimp.read(imagePath);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  
  const threshold = 240;
  
  // Sample edges
  let topWhite = 0, bottomWhite = 0, leftWhite = 0, rightWhite = 0;
  
  for (let x = 0; x < w; x++) {
    const ct = intToRGBA(image.getPixelColor(x, 0));
    const cb = intToRGBA(image.getPixelColor(x, h - 1));
    if (ct.r >= threshold && ct.g >= threshold && ct.b >= threshold) topWhite++;
    if (cb.r >= threshold && cb.g >= threshold && cb.b >= threshold) bottomWhite++;
  }
  
  for (let y = 0; y < h; y++) {
    const cl = intToRGBA(image.getPixelColor(0, y));
    const cr = intToRGBA(image.getPixelColor(w - 1, y));
    if (cl.r >= threshold && cl.g >= threshold && cl.b >= threshold) leftWhite++;
    if (cr.r >= threshold && cr.g >= threshold && cr.b >= threshold) rightWhite++;
  }
  
  return { w, h, topWhite, bottomWhite, leftWhite, rightWhite };
}

async function autoCrop(imagePath, outputPath) {
  const image = await Jimp.read(imagePath);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const threshold = 235;
  
  let top = 0;
  for (let y = 0; y < h; y++) {
    let allWhite = true;
    for (let x = 0; x < w; x++) {
      const c = intToRGBA(image.getPixelColor(x, y));
      if (c.r < threshold || c.g < threshold || c.b < threshold) { allWhite = false; break; }
    }
    if (!allWhite) break;
    top = y + 1;
  }
  
  let bottom = h - 1;
  for (let y = h - 1; y >= 0; y--) {
    let allWhite = true;
    for (let x = 0; x < w; x++) {
      const c = intToRGBA(image.getPixelColor(x, y));
      if (c.r < threshold || c.g < threshold || c.b < threshold) { allWhite = false; break; }
    }
    if (!allWhite) break;
    bottom = y - 1;
  }
  
  let left = 0;
  for (let x = 0; x < w; x++) {
    let allWhite = true;
    for (let y = top; y <= bottom; y++) {
      const c = intToRGBA(image.getPixelColor(x, y));
      if (c.r < threshold || c.g < threshold || c.b < threshold) { allWhite = false; break; }
    }
    if (!allWhite) break;
    left = x + 1;
  }
  
  let right = w - 1;
  for (let x = w - 1; x >= 0; x--) {
    let allWhite = true;
    for (let y = top; y <= bottom; y++) {
      const c = intToRGBA(image.getPixelColor(x, y));
      if (c.r < threshold || c.g < threshold || c.b < threshold) { allWhite = false; break; }
    }
    if (!allWhite) break;
    right = x - 1;
  }
  
  if (top > 0 || bottom < h - 1 || left > 0 || right < w - 1) {
    const cropped = image.crop(left, top, right - left + 1, bottom - top + 1);
    await cropped.writeAsync(outputPath);
    return { cropped: true, from: `${w}x${h}`, to: `${right - left + 1}x${bottom - top + 1}`, top, bottom: h - 1 - bottom, left, right: w - 1 - right };
  }
  return { cropped: false };
}

async function main() {
  // Find Moon Style image files
  const items = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const moonStyle = items.find(i => i.title === 'Moon Style');
  
  if (!moonStyle || !moonStyle.images) {
    console.log('Moon Style not found in items.json');
    return;
  }
  
  console.log('Moon Style image analysis:');
  for (let i = 0; i < moonStyle.images.length; i++) {
    const path = moonStyle.images[i].replace('/uploads/', 'uploads/');
    try {
      const stats = await analyzeWhiteBorder(path);
      console.log(`\nImage ${i+1} (${moonStyle.images[i].split('/').pop()}): ${stats.w}x${stats.h}`);
      console.log(`  Edge white pixels: top=${stats.topWhite}/${stats.w} bottom=${stats.bottomWhite}/${stats.w} left=${stats.leftWhite}/${stats.h} right=${stats.rightWhite}/${stats.h}`);
      
      const cropResult = await autoCrop(path, path.replace('.jpg', '-cropped.jpg'));
      if (cropResult.cropped) {
        console.log(`  CROPPED: ${cropResult.from} → ${cropResult.to} (top:${cropResult.top}, bottom:${cropResult.bottom}, left:${cropResult.left}, right:${cropResult.right})`);
      } else {
        console.log(`  No white border detected`);
      }
    } catch(e) {
      console.log(`  ERROR reading ${path}: ${e.message}`);
    }
  }
}

main().catch(console.error);
