import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import { get } from 'https';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Define pages to scrape: URL -> { section, category }
const PAGES = {
  'https://sites.google.com/view/skyf1re/dice/metal-dice': { section: 'dice', category: 'Metal Dice' },
  'https://sites.google.com/view/skyf1re/dice/resin-dice': { section: 'dice', category: 'Resin Dice' },
  'https://sites.google.com/view/skyf1re/dice/acrylic-dice': { section: 'dice', category: 'Acrylic Dice' },
  'https://sites.google.com/view/skyf1re/dice/wooden-dice': { section: 'dice', category: 'Wooden Dice' },
  'https://sites.google.com/view/skyf1re/dice/acrylic-figurines': { section: 'dice', category: 'Acrylic Figurines' },
  'https://sites.google.com/view/skyf1re/dice/metal-figurines': { section: 'dice', category: 'Metal Figurines' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/citadel-skaven': { section: 'miniatures', category: 'Citadel Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/old-citadel-skaven': { section: 'miniatures', category: 'Old Citadel Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/blood-bowl-skaven': { section: 'miniatures', category: 'Blood Bowl Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/forgeworld-skaven': { section: 'miniatures', category: 'Forgeworld Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/punga-miniatures-skaven': { section: 'miniatures', category: 'Punga Miniatures Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/3d-prints-skaven': { section: 'miniatures', category: '3d Prints Skaven' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/citadel-orks': { section: 'miniatures', category: 'Citadel Orks' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/forgeworld-orks': { section: 'miniatures', category: 'Forgeworld Orks' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/old-citadel-orks-oldhammer': { section: 'miniatures', category: 'Old Citadel Orks (oldhammer)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/artel-w': { section: 'miniatures', category: 'Artel W' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/kromlech': { section: 'miniatures', category: 'Kromlech' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/various-studios': { section: 'miniatures', category: 'Various Studios' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/space-orks/3d-printed-orks': { section: 'miniatures', category: '3d Printed Orks' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/gloomspite-gitz-aos': { section: 'miniatures', category: 'Gloomspite Gitz (AoS)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/adepta-sororitas-40k': { section: 'miniatures', category: 'Adepta Sororitas (40k)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/orruk-warclans-aos': { section: 'miniatures', category: 'Orruk Warclans (AoS)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/chaos-daemons': { section: 'miniatures', category: 'Chaos Daemons' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/soulblight-gravelords-aos': { section: 'miniatures', category: 'Soulblight Gravelords (AoS)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/astra-militarum-40k': { section: 'miniatures', category: 'Astra Militarum (40k)' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/officio-assassinorum': { section: 'miniatures', category: 'Officio Assassinorum' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/ogor-mawtribes': { section: 'miniatures', category: 'Ogor Mawtribes' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/maggotkin-of-nurgle': { section: 'miniatures', category: 'Maggotkin of Nurgle' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/kharadron-overlords': { section: 'miniatures', category: 'Kharadron Overlords' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/empire': { section: 'miniatures', category: 'Empire' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/high-elves': { section: 'miniatures', category: 'High Elves' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/stormcast-eternals': { section: 'miniatures', category: 'Stormcast Eternals' },
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/terrain': { section: 'miniatures', category: 'Terrain' },
  'https://sites.google.com/view/skyf1re/miniatures/other': { section: 'miniatures', category: 'Other' },
  'https://sites.google.com/view/skyf1re/painting-recipes/pictured': { section: 'painting-recipes', category: 'Pictured' },
  'https://sites.google.com/view/skyf1re/painting-recipes/text': { section: 'painting-recipes', category: 'Text' },
};

// Ensure uploads directory exists
mkdirSync('uploads_scraped', { recursive: true });

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      try { file.close(); } catch(e) {}
      try { unlinkSync(dest); } catch(e) {}
      reject(err);
    });
  });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function extractItemsFromPage(page, url, meta) {
  console.log(`\n=== Scraping ${url} ===`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForNetworkIdle({ idleTime: 3000 });
  await new Promise(r => setTimeout(r, 2000));

  const rawItems = await page.evaluate(() => {
    const sections = document.querySelectorAll('section.yaqOZd');
    const results = [];

    sections.forEach((section) => {
      const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
      cells.forEach((cell) => {
        const img = cell.querySelector('img[src*="sitesv-images"]');
        if (!img) return;

        const textSpans = cell.querySelectorAll('span, div, p');
        const texts = [];
        textSpans.forEach(el => {
          const t = el.textContent.trim();
          if (t && el.children.length === 0 && t.length > 0) {
            texts.push(t);
          }
        });

        const allText = cell.textContent.trim();
        if (allText.length === 0) return;

        results.push({
          imgSrc: img.src,
          texts: texts.filter((t, i, a) => a.indexOf(t) === i),
          allText,
        });
      });
    });

    return results;
  });

  console.log(`  Found ${rawItems.length} raw items`);

  // Deduplicate: multiple cells may have the same image URL (spacer cells)
  // We keep only the first occurrence of each unique image URL
  const seenUrls = new Set();
  const items = [];
  for (const item of rawItems) {
    if (!seenUrls.has(item.imgSrc)) {
      seenUrls.add(item.imgSrc);
      items.push(item);
    }
  }

  console.log(`  Deduplicated to ${items.length} items`);

  // Process items: download images, create entries
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const texts = item.texts.filter(t => t.length > 0);

    // Parse title and author from text
    // Pattern: "Title (author)" or "Title author" or just "Title"
    let title = texts[0] || item.allText;
    let author = '';

    // Check if there's a parenthetical author (e.g., "(by Q-workshop)")
    if (texts.length >= 2) {
      const second = texts[1];
      if (second.startsWith('(') || second.startsWith('by')) {
        author = second.replace(/^[\(\s]*/, '').replace(/[\)\s]*$/, '');
      } else if (texts.length >= 3 && texts[2].startsWith('(')) {
        author = texts[2].replace(/^[\(\s]*/, '').replace(/[\)\s]*$/, '');
      }
    }

    // Also check if title itself contains parenthetical
    const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      title = parenMatch[1].trim();
      if (!author) author = parenMatch[2].trim();
    }

    // Generate a unique filename
    const urlSlug = url.split('/').pop();
    const imgExt = '.jpg';
    const filename = `${urlSlug}-${i + 1}${imgExt}`;
    const localPath = `uploads_scraped/${filename}`;

    // Check if author has special characters that need cleaning
    author = author.trim();
    title = title.trim();

    entries.push({
      title,
      author,
      section: meta.section,
      category: meta.category,
      imageUrl: item.imgSrc,
      localFile: filename,
      localPath,
    });
  }

  return entries;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const allEntries = [];
  const failedPages = [];

  for (const [url, meta] of Object.entries(PAGES)) {
    try {
      const entries = await extractItemsFromPage(page, url, meta);
      
      // Download images
      for (const entry of entries) {
        try {
          await downloadImage(entry.imageUrl, entry.localPath);
          console.log(`  Downloaded: ${entry.localFile} (${entry.title})`);
        } catch (err) {
          console.log(`  FAILED download for ${entry.title}: ${err.message}`);
        }
      }

      allEntries.push(...entries);
      console.log(`  Page done: ${entries.length} items scraped`);
    } catch (err) {
      console.log(`  PAGE FAILED: ${err.message}`);
      failedPages.push(url);
    }

    // Save progress after each page
    writeFileSync('scrape_progress.json', JSON.stringify({
      totalItems: allEntries.length,
      failedPages,
      entries: allEntries,
    }, null, 2));
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Total items scraped: ${allEntries.length}`);
  console.log(`Failed pages: ${failedPages.length}`);

  writeFileSync('scraped_data.json', JSON.stringify({ entries: allEntries, failedPages }, null, 2));

  await browser.close();
}

main().catch(console.error);
