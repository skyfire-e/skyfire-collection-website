import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'fs';

const dir = 'uploads';
const files = readdirSync(dir).filter(f => f.startsWith('stone-dice-') && f.endsWith('.jpg'));

console.log('Re-cropping', files.length, 'stone dice images...');
let done = 0;
for (const file of files) {
  const path = dir + '/' + file;
  try {
    const buf = await sharp(path).trim({ threshold: 15, background: 'white' }).toBuffer();
    writeFileSync(path, buf);
    done++;
  } catch (e) {
    console.log('  FAILED', file, e.message);
  }
}
console.log('Cropped', done, 'images');
