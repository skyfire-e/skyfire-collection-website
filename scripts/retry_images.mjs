import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCRAPED_DIR = 'uploads_scraped';
const PROGRESS_FILE = 'scrape_v2_progress.json';
mkdirSync(SCRAPED_DIR, { recursive: true });

// Pages still missing images (only those with failed downloads)
const PAGES_TO_RETRY = [
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/various-studios',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/3d-printed-orks',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/gloomspite-gitz-aos',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/adepta-sororitas-40k',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/orruk-warclans-aos',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/chaos-daemons',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/soulblight-gravelords-aos',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/astra-militarum-40k',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/officio-assassinorum',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/ogor-mawtribes',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/maggotkin-of-nurgle',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/kharadron-overlords',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/empire',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/high-elves',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/stormcast-eternals',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/terrain',
  'https://sites.google.com/view/skyf1re/miniatures/other',
  'https://sites.google.com/view/skyf1re/painting-recipes/pictured',
  'https://sites.google.com/view/skyf1re/painting-recipes/text',
  'https://sites.google.com/view/skyf1re/dice/wooden-dice',
];

// Load existing scrape data for item titles
const existingData = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));

// Build a map: imageUrl -> { title, localFile }
const urlToFile = {};
for (const entry of existingData.entries) {
  urlToFile[entry.imageUrl] = { localFile: entry.localFile, title: entry.title, section: entry.section, category: entry.category };
}

async function downloadPageImages(page, url) {
  console.log(`\n=== ${url} ===`);
  
  const capturedImages = new Map(); // url -> buffer

  // Intercept responses to capture image data
  await page.setRequestInterception(true);
  page.on('request', request => {
    request.continue();
  });

  page.on('response', async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes('sitesv-images') && response.status() === 200) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.startsWith('image/')) {
        try {
          const buffer = await response.buffer();
          capturedImages.set(reqUrl, buffer);
        } catch (e) {
          // ignore
        }
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForNetworkIdle({ idleTime: 3000 });
    await new Promise(r => setTimeout(r, 3000));
  } catch (err) {
    console.log(`  Navigation error: ${err.message}`);
  }

  await page.setRequestInterception(false);
  page.removeAllListeners('request');
  page.removeAllListeners('response');

  console.log(`  Captured ${capturedImages.size} unique images`);

  // Save captured images
  let saved = 0;
  for (const [imgUrl, buffer] of capturedImages) {
    const info = urlToFile[imgUrl];
    if (info && info.localFile) {
      const filePath = join(SCRAPED_DIR, info.localFile);
      const existingSize = existsSync(filePath) ? statSync(filePath).size : 0;
      if (existingSize < 500) {
        writeFileSync(filePath, buffer);
        saved++;
        console.log(`  Saved: ${info.localFile} (${buffer.length} bytes)`);
      }
    }
  }
  console.log(`  Saved ${saved} new images`);

  return saved;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let totalNew = 0;
  for (const url of PAGES_TO_RETRY) {
    const saved = await downloadPageImages(page, url);
    totalNew += saved;
  }

  console.log(`\nTotal new images saved: ${totalNew}`);

  // Final count
  const files = readdirSync(SCRAPED_DIR);
  const goodFiles = files.filter(f => statSync(join(SCRAPED_DIR, f)).size > 500);
  const badFiles = files.filter(f => statSync(join(SCRAPED_DIR, f)).size <= 500);
  console.log(`Total: ${files.length} files (${goodFiles.length} good, ${badFiles.length} bad/empty)`);

  await browser.close();
}

main().catch(console.error);
