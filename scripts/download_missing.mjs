import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCRAPED_DIR = 'uploads_scraped';

const data = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));
const entries = data.entries;

// Find entries with missing/empty images
const missing = entries.filter(e => {
  if (!e.localFile) return true;
  try {
    const stats = statSync(join(SCRAPED_DIR, e.localFile));
    return stats.size < 500;
  } catch {
    return true;
  }
});

console.log(`Total entries: ${entries.length}`);
console.log(`Missing images: ${missing.length}`);

// Deduplicate by imageUrl to avoid duplicate downloads
const seen = new Set();
const toDownload = missing.filter(e => {
  if (seen.has(e.imageUrl)) return false;
  seen.add(e.imageUrl);
  return true;
});

console.log(`Unique images to download: ${toDownload.length}`);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // First, establish session by visiting the Google Sites page
  await page.goto('https://sites.google.com/view/skyf1re/home', { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Session established');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toDownload.length; i++) {
    const entry = toDownload[i];
    const dest = join(SCRAPED_DIR, entry.localFile);

    try {
      process.stdout.write(`[${i + 1}/${toDownload.length}] ${entry.title}... `);
      
      const result = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }, entry.imageUrl);

      const data = result.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(data, 'base64');
      writeFileSync(dest, buffer);
      console.log(`OK (${buffer.length} bytes)`);
      success++;
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      failed++;
    }

    // Throttle downloads to avoid rate limiting
    if (i % 5 === 4) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone: ${success} downloaded, ${failed} failed`);
  await browser.close();
}

main().catch(console.error);
