import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

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

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Extract items with their carousel images 
const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const allItems = [];

  sections.forEach((section) => {
    const sectionText = section.textContent.trim();
    // Only process the Stone Dice section (skip header, navigation etc.)
    if (!sectionText.includes('Stone Dice') && !sectionText.match(/Moon|Anubis|Blood Red|Black|Cat Style|Micro dice|Aquamarine|Garnet|Raised|Dichroic|Semiprecious/)) {
      return;
    }

    const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
    let currentItem = null;

    cells.forEach((cell) => {
      const text = cell.textContent.trim();
      
      // Check if this cell has a title (text-only cell)
      if (text && !text.includes('Stone Dice') && text.length > 3) {
        // Check that it doesn't have background images (it's a text label)
        const hasBg = (() => {
          const els = cell.querySelectorAll('*');
          for (const el of els) {
            try {
              const bg = window.getComputedStyle(el).backgroundImage;
              if (bg && bg !== 'none' && bg.includes('sitesv-images')) return true;
            } catch(e) {}
          }
          return false;
        })();

        if (!hasBg) {
          // This is a title cell
          if (currentItem) allItems.push(currentItem);
          currentItem = { title: text, images: [] };
          return;
        }
      }

      // This cell might have carousel images
      if (currentItem) {
        const els = cell.querySelectorAll('*');
        const urls = new Set();
        els.forEach(el => {
          try {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
              const url = bg.replace(/^url\(["']?|["']?\)$/g, '');
              urls.add(url);
            }
          } catch(e) {}
        });
        
        urls.forEach(url => {
          if (!currentItem.images.includes(url)) {
            currentItem.images.push(url);
          }
        });
      }
    });

    if (currentItem) allItems.push(currentItem);
  });

  return allItems;
});

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" - ${item.images.length} images`);
  item.images.forEach((url, j) => {
    console.log(`       img ${j+1}: ${url.slice(0, 80)}...`);
  });
});

// Now download the images and save them
const allImages = [];

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `stone-dice-${i + 1}-${j + 1}.jpg`;
    
    // Download via Puppeteer by navigating to the image URL
    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  Downloaded: ${filename} (${kb}KB) → ${item.title}`);
      allImages.push({ filename, itemIdx: i, imgIdx: j });
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

// Export the mapping for import script
console.log('\n=== MAPPING ===');
const mapping = items.map((item, i) => ({
  title: item.title,
  images: item.images.map((_, j) => `stone-dice-${i + 1}-${j + 1}.jpg`),
}));
console.log(JSON.stringify(mapping, null, 2));
writeFileSync('stone-dice-mapping.json', JSON.stringify(mapping, null, 2));

await browser.close();
