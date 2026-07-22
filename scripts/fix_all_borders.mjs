import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

for (const item of items) {
  if (item.images) {
    for (let i = 0; i < item.images.length; i++) {
      const imgPath = item.images[i].replace('/uploads/', 'uploads/');
      try {
        const meta = await sharp(imgPath).metadata();
        const { width: w, height: h } = meta;
        
        const buffer = await sharp(imgPath).ensureAlpha().raw().toBuffer();
        const threshold = 250;
        
        let top = 0;
        for (let y = 0; y < h; y++) {
          let allWhite = true;
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) { allWhite = false; break; }
          }
          if (!allWhite) break;
          top = y + 1;
        }
        
        let bottom = h - 1;
        for (let y = h - 1; y >= 0; y--) {
          let allWhite = true;
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) { allWhite = false; break; }
          }
          if (!allWhite) break;
          bottom = y - 1;
        }
        
        let left = 0;
        for (let x = 0; x < w; x++) {
          let allWhite = true;
          for (let y = top; y <= bottom; y++) {
            const idx = (y * w + x) * 4;
            if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) { allWhite = false; break; }
          }
          if (!allWhite) break;
          left = x + 1;
        }
        
        let right = w - 1;
        for (let x = w - 1; x >= 0; x--) {
          let allWhite = true;
          for (let y = top; y <= bottom; y++) {
            const idx = (y * w + x) * 4;
            if (buffer[idx] < threshold || buffer[idx+1] < threshold || buffer[idx+2] < threshold) { allWhite = false; break; }
          }
          if (!allWhite) break;
          right = x - 1;
        }
        
        const borders = { top, bottom: h - 1 - bottom, left, right: w - 1 - right };
        const hasBorders = top > 0 || bottom < h - 1 || left > 0 || right < w - 1;
        
        if (hasBorders) {
          console.log(`${item.title} img ${i+1}: ${w}x${h} → BORDERS top=${borders.top} bottom=${borders.bottom} left=${borders.left} right=${borders.right}`);
          
          // Fix it
          const newW = right - left + 1;
          const newH = bottom - top + 1;
          const cropped = await sharp(imgPath)
            .extract({ left, top, width: newW, height: newH })
            .jpeg({ quality: 95 })
            .toBuffer();
          writeFileSync(imgPath, cropped);
          console.log(`  → Fixed: ${newW}x${newH} JPEG (${(cropped.length / 1024).toFixed(0)}KB)`);
        } else {
          console.log(`${item.title} img ${i+1}: ${w}x${h} → OK`);
        }
      } catch(e) {
        console.log(`${item.title} img ${i+1}: ERROR - ${e.message}`);
      }
    }
  }
}
