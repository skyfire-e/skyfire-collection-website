import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
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

// Capture image responses with their section info
const capturedImages = [];

page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('sitesv-images') && url.endsWith('=w16383') && response.status() === 200) {
    const ct = response.headers()['content-type'] || '';
    if (ct.startsWith('image/')) {
      try {
        const buffer = await response.buffer();
        capturedImages.push({ url, buffer });
      } catch (e) {}
    }
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

console.log(`Captured ${capturedImages.length} images`);

// Remove duplicates (same image URL appearing twice)
const seen = new Set();
const uniqueImages = capturedImages.filter(img => {
  if (seen.has(img.url)) return false;
  seen.add(img.url);
  return true;
});

console.log(`Unique images: ${uniqueImages.length}`);

// Define the 6 items manually from page text
const items = [
  { title: 'Moon Style', author: 'Aquamarine Zircon', imageCount: 0 },
  { title: 'Anubis', author: '', imageCount: 0 },
  { title: 'Blood Red', author: 'Garnet Zircon', imageCount: 0 },
  { title: 'Black', author: 'Raised Obsidian', imageCount: 0 },
  { title: 'Cat Style', author: 'Dichroic Glass', imageCount: 0 },
  { title: 'Micro dice', author: 'Semiprecious stones', imageCount: 0 },
];

// Distribute images among items (sequential grouping)
// 21 images, 6 items = ~3-4 per item
let imgIdx = 0;
for (let i = 0; i < items.length; i++) {
  // Estimate images per item: total / remaining
  const remaining = items.length - i;
  const perItem = Math.round(uniqueImages.length / remaining);
  const count = i < items.length - 1 ? perItem : uniqueImages.length - imgIdx;
  
  items[i].images = uniqueImages.slice(imgIdx, imgIdx + count).map((img, j) => ({
    filename: `stone-dice-${i + 1}-${j + 1}.jpg`,
    buffer: img.buffer,
  }));
  imgIdx += count;
}

// Save images and generate Postman payload
for (const item of items) {
  for (const img of item.images) {
    const filePath = join(UPLOAD_DIR, img.filename);
    writeFileSync(filePath, img.buffer);
    img.imageUrl = `/uploads/${img.filename}`;
  }
}

console.log('\n=== ITEMS ===');
for (const item of items) {
  console.log(`\n${item.title} ${item.author ? '(' + item.author + ')' : ''}: ${item.images.length} photos`);
  for (const img of item.images) {
    console.log(`  ${img.filename} (${img.buffer.length} bytes)`);
  }
}

// Output curl commands for each item
for (const item of items) {
  const label = `${item.title}${item.author ? ' (' + item.author + ')' : ''}`;
  for (let j = 0; j < item.images.length; j++) {
    const img = item.images[j];
    const isPrimary = j === 0;
    console.log(`\ncurl -X POST http://localhost:3000/api/items \\`);
    console.log(`  -H "Content-Type: multipart/form-data" \\`);
    console.log(`  -F "title=${item.title}" \\`);
    console.log(`  -F "author=${item.author}" \\`);
    console.log(`  -F "section=dice" \\`);
    console.log(`  -F "category=stone-dice" \\`);
    console.log(`  -F "image=@${UPLOAD_DIR}/${img.filename}"`);
  }
}

// Alternative: Generate a JSON import script
const apiEntries = [];
for (const item of items) {
  for (let j = 0; j < item.images.length; j++) {
    const img = item.images[j];
    apiEntries.push({
      title: item.title,
      author: item.author,
      section: 'dice',
      category: 'stone-dice',
      image: img.imageUrl,
      price: '',
      subIndex: j,
    });
  }
}

writeFileSync('stone-dice-import.json', JSON.stringify(apiEntries, null, 2));
console.log('\nImport data saved to stone-dice-import.json');

await browser.close();
