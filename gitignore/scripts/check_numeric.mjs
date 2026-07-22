import { readFileSync } from 'fs';

const scraped = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));
const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Check numeric-only titles that weren't filtered
const bad = scraped.entries.filter(e => {
  const title = e.title.replace(/^\d+\)\s*/, '').trim();
  return /^\d+$/.test(title) && e.section !== 'painting-recipes';
});

console.log(`Numeric titles (non-painting, should have been filtered): ${bad.length}`);
bad.slice(0, 15).forEach(e => {
  const cleaned = e.title.replace(/^\d+\)\s*/, '').trim();
  console.log(`  "${e.title}" -> "${cleaned}" (${e.category})`);
});

// Check if any ended up in items.json
const numericInItems = items.filter(item => /^\d+$/.test(item.title));
console.log(`\nNumeric titles in items.json: ${numericInItems.length}`);
if (numericInItems.length > 0) {
  numericInItems.slice(0, 10).forEach(item => console.log(`  "${item.title}" (${item.section}/${item.category})`));
}
