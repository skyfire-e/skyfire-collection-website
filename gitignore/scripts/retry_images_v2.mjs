import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCRAPED_DIR = 'uploads_scraped';

const existingData = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));

// Group entries by page (using localFile prefix)
const entriesByPage = {};
for (const entry of existingData.entries) {
  const prefix = entry.localFile ? entry.localFile.replace(/-\d+\.\w+$/, '') : 'unknown';
  if (!entriesByPage[prefix]) entriesByPage[prefix] = [];
  entriesByPage[prefix].push(entry);
}

// Find pages with missing images
const pagesWithMissing = [];
for (const [prefix, entries] of Object.entries(entriesByPage)) {
  const firstMissing = entries.find(e => {
    if (!e.localFile) return true;
    try {
      const stats = statSync(join(SCRAPED_DIR, e.localFile));
      return stats.size < 500;
    } catch { return true; }
  });
  if (firstMissing) {
    // Reconstruct the original page URL from the first entry's imageUrl context
    // We need to know the URL - let's look at the pattern
    const entry0 = entries[0];
    pagesWithMissing.push({ prefix, entries });
  }
}

console.log(`Pages with missing images: ${pagesWithMissing.length}`);
for (const p of pagesWithMissing) {
  const missing = p.entries.filter(e => {
    try { return statSync(join(SCRAPED_DIR, e.localFile)).size < 500; } catch { return true; }
  });
  console.log(`  ${p.prefix}: ${missing.length}/${p.entries.length} missing`);
}

// Map page prefixes to URLs
const PREFIX_TO_URL = {
  'various-studios': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/various-studios',
  '3d-printed-orks': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/3d-printed-orks',
  'gloomspite-gitz-aos': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/gloomspite-gitz-aos',
  'adepta-sororitas-40k': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/adepta-sororitas-40k',
  'orruk-warclans-aos': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/orruk-warclans-aos',
  'chaos-daemons': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/chaos-daemons',
  'soulblight-gravelords-aos': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/soulblight-gravelords-aos',
  'astra-militarum-40k': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/astra-militarum-40k',
  'officio-assassinorum': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/officio-assassinorum',
  'ogor-mawtribes': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/ogor-mawtribes',
  'maggotkin-of-nurgle': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/maggotkin-of-nurgle',
  'kharadron-overlords': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/kharadron-overlords',
  'empire': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/empire',
  'high-elves': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/high-elves',
  'stormcast-eternals': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/stormcast-eternals',
  'terrain': 'https://sites.google.com/view/skyf1re/miniatures/warhammer/terrain',
  'other': 'https://sites.google.com/view/skyf1re/miniatures/other',
  'pictured': 'https://sites.google.com/view/skyf1re/painting-recipes/pictured',
  'text': 'https://sites.google.com/view/skyf1re/painting-recipes/text',
  'wooden-dice': 'https://sites.google.com/view/skyf1re/dice/wooden-dice',
};

async function savePageImages(page, prefix, entries, url) {
  console.log(`\n=== ${prefix} (${url}) ===`);
  
  const capturedImages = [];

  page.on('response', async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes('sitesv-images') && response.status() === 200) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.startsWith('image/')) {
        try {
          const buffer = await response.buffer();
          capturedImages.push(buffer);
        } catch (e) {}
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

  page.removeAllListeners('response');

  if (capturedImages.length === 0) {
    console.log(`  No images captured!`);
    return 0;
  }

  // Deduplicate by comparing buffers (crude but works for identical images)
  const uniqueBuffers = [];
  const seenSizes = new Set();
  for (const buf of capturedImages) {
    const key = buf.length;
    if (!seenSizes.has(key)) {
      seenSizes.add(key);
      uniqueBuffers.push(buf);
    }
  }

  console.log(`  Captured ${uniqueBuffers.length} unique images`);

  // Pair captured images with entries (they should be in the same order)
  let saved = 0;
  for (let i = 0; i < Math.min(uniqueBuffers.length, entries.length); i++) {
    const entry = entries[i];
    const buffer = uniqueBuffers[i];
    const filePath = join(SCRAPED_DIR, entry.localFile);
    writeFileSync(filePath, buffer);
    console.log(`  Saved: ${entry.localFile} (${buffer.length} bytes) - ${entry.title}`);
    saved++;
  }

  if (uniqueBuffers.length > entries.length) {
    console.log(`  (${uniqueBuffers.length - entries.length} extra images not needed)`);
  }
  if (uniqueBuffers.length < entries.length) {
    console.log(`  WARNING: ${entries.length - uniqueBuffers.length} entries have no image`);
  }

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

  let totalSaved = 0;
  let processed = 0;

  for (const { prefix, entries } of pagesWithMissing) {
    const url = PREFIX_TO_URL[prefix];
    if (!url) {
      console.log(`\n=== ${prefix} - NO URL MAPPING, skipping ===`);
      continue;
    }
    const saved = await savePageImages(page, prefix, entries, url);
    totalSaved += saved;
    processed++;

    // Add a small delay between pages
    await new Promise(r => setTimeout(r, 2000));
  }

  // Final count
  const files = readdirSync(SCRAPED_DIR);
  const goodFiles = files.filter(f => statSync(join(SCRAPED_DIR, f)).size > 500);
  const badFiles = files.filter(f => statSync(join(SCRAPED_DIR, f)).size <= 500);
  console.log(`\nProcessed ${processed} pages, saved ${totalSaved} images`);
  console.log(`Final: ${files.length} files (${goodFiles.length} good, ${badFiles.length} bad/empty)`);

  await browser.close();
}

main().catch(console.error);
