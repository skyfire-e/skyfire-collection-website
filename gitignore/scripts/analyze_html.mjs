import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('stone-dice-html.html', 'utf8');

// Find all sections with their text and background images
// Pattern: sections have background-image in style attribute
const sectionPattern = /background-image:\s*url\(([^)]+)\)[^<]*<div[^>]*jsname="LQX2Vd"[^>]*>/g;
const images = [];
let match;
while ((match = sectionPattern.exec(html)) !== null) {
  const url = match[1].trim();
  images.push({ url, pos: match.index });
}

console.log('Sections with background images:', images.length);
images.forEach((img, i) => {
  console.log(`  ${i+1}. ${img.url.slice(0, 100)}...`);
});

// Also find ALL background-image URLs to count them
const allBg = html.match(/background-image:\s*url\([^)]+\)/g);
console.log(`\nTotal background-image occurrences: ${allBg ? allBg.length : 0}`);

// Find text content near each section
// Let's look for the structure: section > div.Nu95r (bg) > div.mYVXT (content with text)
const sections = html.match(/<section[^>]*>[\s\S]*?<\/section>/g);
console.log(`\nTotal <section> elements: ${sections ? sections.length : 0}`);

if (sections) {
  sections.forEach((s, i) => {
    // Extract text content (remove all HTML tags)
    const text = s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const hasBg = s.includes('background-image');
    const bgUrl = s.match(/background-image:\s*url\(([^)]+)\)/);
    if (hasBg) {
      console.log(`\nSection ${i+1} (has bg): ${text.slice(0, 120)}...`);
      if (bgUrl) console.log(`  bg: ${bgUrl[1].slice(0, 80)}...`);
    }
  });
}
