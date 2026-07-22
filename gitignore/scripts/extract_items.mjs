import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = 'https://sites.google.com/view/skyf1re/dice/metal-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });

// Wait a bit more for images
await new Promise(r => setTimeout(r, 2000));

const items = await page.evaluate(() => {
  // Find all section elements that contain images
  const sections = document.querySelectorAll('section.yaqOZd');
  const results = [];

  sections.forEach((section, sectionIdx) => {
    // Find grid cells within this section
    const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
    
    cells.forEach((cell, cellIdx) => {
      const img = cell.querySelector('img[src*="sitesv-images"]');
      if (!img) return;

      // Get all text content from this cell (excluding the image alt)
      const textSpans = cell.querySelectorAll('span, div, p');
      const texts = [];
      textSpans.forEach(el => {
        const t = el.textContent.trim();
        if (t && el.children.length === 0 && t.length > 0) {
          texts.push(t);
        }
      });

      // Also try to get the nearby sibling text that appears after the image
      const parentOfImg = img.closest('div');
      const allTextInCell = cell.textContent.trim();

      results.push({
        sectionIdx,
        cellIdx,
        imgSrc: img.src,
        imgAlt: img.alt,
        texts: texts.filter((t, i, a) => a.indexOf(t) === i).slice(0, 10),
        allText: allTextInCell.slice(0, 300),
      });
    });

    // If no cells found, try a different approach - look directly at grid columns
    if (results.filter(r => r.sectionIdx === sectionIdx).length === 0) {
      // Find direct children that might contain images
      const children = section.querySelectorAll(':scope > div > div > div > [class*="hJDwNd-"], :scope > div > div > [class*="hJDwNd-"]');
      children.forEach((child, childIdx) => {
        const img = child.querySelector('img[src*="sitesv-images"]');
        if (!img) return;
        const texts = [];
        const textEls = child.querySelectorAll('span, div, p');
        textEls.forEach(el => {
          const t = el.textContent.trim();
          if (t && el.children.length === 0 && t.length > 0) {
            texts.push(t);
          }
        });
        results.push({
          sectionIdx,
          cellIdx: childIdx,
          imgSrc: img.src,
          imgAlt: img.alt,
          texts: texts.filter((t, i, a) => a.indexOf(t) === i).slice(0, 10),
          allText: child.textContent.trim().slice(0, 300),
        });
      });
    }
  });

  return results;
});

console.log(`Found ${items.length} items`);
items.forEach((item, i) => {
  console.log(`\nItem ${i + 1}:`);
  console.log(`  Section: ${item.sectionIdx}, Cell: ${item.cellIdx}`);
  console.log(`  Img src: ${item.imgSrc.slice(0, 80)}...`);
  console.log(`  Texts: ${JSON.stringify(item.texts)}`);
  console.log(`  All text: "${item.allText.slice(0, 150)}"`);
});

writeFileSync('metal-dice-items.json', JSON.stringify(items, null, 2));

await browser.close();
