import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { get } from 'https';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROGRESS_FILE = 'scrape_progress.json';

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

mkdirSync('uploads_scraped', { recursive: true });

// Download image using the browser context to get proper cookies/headers
async function downloadImageViaBrowser(page, url, dest) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Get the page content (raw image data)
    const imgData = await page.evaluate(() => {
      return document.body.innerText || '';
    });
    
    // If it's actual image content, the body will be empty or contain raw bytes
    // Instead, let's save what we got from the page
    const contentType = await page.evaluate(() => {
      return document.contentType || '';
    });
    
    // Actually, for images loaded via page.goto, we can capture the response
    return false; // fall through to alternative method
  } catch (err) {
    return false;
  }
}

// Alternative: capture image responses during page load
async function scrapePage(page, url, meta) {
  console.log(`\n=== ${meta.section}/${meta.category} ===`);
  
  // Navigate and wait for images to load
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForNetworkIdle({ idleTime: 3000 });
  await new Promise(r => setTimeout(r, 2000));

  // Extract image URLs and text from the page
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
          if (t && el.children.length === 0 && t.length > 0) texts.push(t);
        });
        const allText = cell.textContent.trim();
        if (allText.length === 0) return;
        results.push({ imgSrc: img.src, texts: texts.filter((t, i, a) => a.indexOf(t) === i), allText });
      });
    });
    return results;
  });

  // Deduplicate by image URL (keep first occurrence)
  const seenUrls = new Set();
  const items = [];
  for (const item of rawItems) {
    if (!seenUrls.has(item.imgSrc)) {
      seenUrls.add(item.imgSrc);
      items.push(item);
    }
  }

  console.log(`  ${items.length} items`);

  // Process each item: extract title/author, download image
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const texts = item.texts.filter(t => t.length > 0);
    let title = texts[0] || item.allText;
    let author = '';

    // Parse author from text patterns
    if (texts.length >= 2) {
      const second = texts[1];
      if (second.startsWith('(') || second.startsWith('by')) {
        author = second.replace(/^[\(\s]*/, '').replace(/[\)\s]*$/, '');
      }
    }
    if (!author && texts.length >= 3) {
      const third = texts[2];
      if (third.startsWith('(')) {
        author = third.replace(/^[\(\s]*/, '').replace(/[\)\s]*$/, '');
      }
    }

    // Check if title contains parenthetical author
    const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      title = parenMatch[1].trim();
      if (!author) author = parenMatch[2].trim();
    }

    // Clean up titles that are just numbers
    if (/^\d+$/.test(title.trim())) {
      title = `${meta.category} #${title.trim()}`;
    }

    // Generate filename from URL slug
    const urlSlug = url.split('/').pop() || meta.category.toLowerCase().replace(/\s+/g, '-');
    const filename = `${urlSlug}-${i + 1}.jpg`;
    const localPath = `uploads_scraped/${filename}`;

    author = author.trim();
    title = title.trim().replace(/^\d+\)\s*/, ''); // Remove leading numbers like "2) "

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

  // Now download images using the page's fetch (which has proper cookies)
  console.log(`  Downloading ${entries.length} images...`);
  for (const entry of entries) {
    try {
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

      // Convert base64 data URL to buffer
      const data = result.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(data, 'base64');
      writeFileSync(entry.localPath, buffer);
    } catch (err) {
      console.log(`  ! Failed: ${entry.title} (${err.message})`);
      // Mark as having no local image
      entry.localFile = '';
      entry.localPath = '';
    }
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

  for (const [url, meta] of Object.entries(PAGES)) {
    try {
      const entries = await scrapePage(page, url, meta);
      allEntries.push(...entries);
      
      // Save progress
      writeFileSync(PROGRESS_FILE, JSON.stringify({
        totalItems: allEntries.length,
        entries: allEntries,
      }, null, 2));
    } catch (err) {
      console.log(`  PAGE ERROR: ${err.message}`);
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Total items: ${allEntries.length}`);

  writeFileSync('scraped_data.json', JSON.stringify({ entries: allEntries }, null, 2));

  await browser.close();
}

main().catch(console.error);
