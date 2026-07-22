import { readFileSync } from 'fs';

const html = readFileSync('stone-dice-html.html', 'utf8');

// Check if images are in escaped JSON
const imgInJSON = html.match(/sitesv-images/g);
console.log(`'sitesv-images' occurrences in HTML: ${imgInJSON ? imgInJSON.length : 0}`);

// Check for unescaped img tags
const imgTags = html.match(/<img[^>]*>/g);
console.log(`<img> tags in HTML: ${imgTags ? imgTags.length : 0}`);

// Check what contains the image URLs
const idx = html.indexOf('sitesv-images');
if (idx >= 0) {
  console.log('\nContext around first occurrence:');
  console.log(html.substring(Math.max(0, idx - 200), idx + 300));
}
