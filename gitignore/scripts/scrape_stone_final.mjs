import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';
const UPLOAD_DIR = 'uploads';

mkdirSync(UPLOAD_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Capture all image responses
const captured = [];
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('sitesv-images') && response.status() === 200) {
    const ct = response.headers()['content-type'] || '';
    if (ct.startsWith('image/')) {
      try { captured.push({ url, buffer: await response.buffer() }); } catch (e) {}
    }
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Deduplicate
const seen = new Set();
const images = captured.filter(img => {
  if (seen.has(img.url)) return false;
  seen.add(img.url);
  return true;
});

console.log(`Unique images: ${images.length}`);

// Save all images sequentially
const savedImages = [];
for (let i = 0; i < images.length; i++) {
  const filename = `stone-dice-${i + 1}.jpg`;
  writeFileSync(join(UPLOAD_DIR, filename), images[i].buffer);
  savedImages.push({ filename, size: images[i].buffer.length });
  console.log(`  ${filename} (${images[i].buffer.length} bytes)`);
}

console.log(`\nSaved ${savedImages.length} images to uploads/`);

// Now add items to the API via HTTP
const http = await import('http');

function postItem(item) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: item.title,
      author: item.author,
      section: 'dice',
      category: 'stone-dice',
      image: item.image,
    });
    const req = http.request('http://localhost:3000/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

console.log('\nItems (add manually via admin panel):');
const items = [
  { title: 'Moon Style', author: 'Aquamarine Zircon', count: 3 },
  { title: 'Anubis', author: '', count: 3 },
  { title: 'Blood Red', author: 'Garnet Zircon', count: 4 },
  { title: 'Black', author: 'Raised Obsidian', count: 4 },
  { title: 'Cat Style', author: 'Dichroic Glass', count: 3 },
  { title: 'Micro dice', author: 'Semiprecious stones', count: 3 },
];

let imgCursor = 0;
for (const item of items) {
  const primaryImg = savedImages[imgCursor];
  console.log(`\ncurl -X POST http://localhost:3000/api/items \\`);
  console.log(`  -H "Content-Type: multipart/form-data" \\`);
  console.log(`  -F "title=${item.title}" \\`);
  console.log(`  -F "author=${item.author}" \\`);
  console.log(`  -F "section=dice" -F "category=stone-dice"`);
  
  for (let j = 0; j < item.count && imgCursor < savedImages.length; j++) {
    console.log(`  -F "image=@uploads/${savedImages[imgCursor].filename}"`);
    imgCursor++;
  }
}
console.log(`\nTotal images mapped: ${imgCursor}/${savedImages.length}`);

await browser.close();
