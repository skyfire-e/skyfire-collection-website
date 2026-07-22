import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCRAPED_DIR = 'uploads_scraped';

const existingData = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));

// Build map of imageUrl -> localFile (normalize by taking up to '=' sign)
const urlToFile = {};
for (const entry of existingData.entries) {
  // Normalize by removing everything after =w (size parameter)
  const normalized = entry.imageUrl.replace(/=w\d+.*$/, '');
  urlToFile[normalized] = entry;
}

console.log('Sample normalized URLs from data:');
let count = 0;
for (const [url, entry] of Object.entries(urlToFile)) {
  if (count++ < 3) console.log(`  ${url.slice(0, 150)}... -> ${entry.localFile}`);
}
console.log(`Total entries in map: ${Object.keys(urlToFile).length}`);

const testUrl = 'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/various-studios';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Capture image URLs as they load
const capturedUrls = new Set();

page.on('response', async (response) => {
  const reqUrl = response.url();
  if (reqUrl.includes('sitesv-images') && response.status() === 200) {
    capturedUrls.add(reqUrl);
  }
});

await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 3000 });
await new Promise(r => setTimeout(r, 2000));

console.log(`\nCaptured ${capturedUrls.size} image URLs from page`);
console.log('Sample captured URLs:');
let i = 0;
for (const url of capturedUrls) {
  if (i++ < 5) console.log(`  ${url.slice(0, 200)}`);
}

// Check matches
console.log('\nMatching against data:');
const normalizedCaptured = [];
for (const url of capturedUrls) {
  const normalized = url.replace(/=w\d+.*$/, '');
  normalizedCaptured.push(normalized);
  const match = urlToFile[normalized];
  if (match) {
    console.log(`  MATCH: ${match.localFile} (${match.title})`);
  } else {
    // Show first 5 non-matches
    if (i < 10) console.log(`  NO MATCH: ${normalized.slice(0, 150)}`);
    i++;
  }
}

// Also check if the existing files exist for the matched ones
console.log('\nChecking existing files...');
for (const [norm, entry] of Object.entries(urlToFile).slice(0, 10)) {
  const fpath = join(SCRAPED_DIR, entry.localFile);
  const exists = statSync(fpath);
  console.log(`  ${entry.localFile}: ${exists.size} bytes`);
}

await browser.close();
