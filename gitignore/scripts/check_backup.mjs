import { readFileSync } from 'fs';
const items = JSON.parse(readFileSync('backup_scraped/items.json', 'utf8'));

const stone = items.filter(i => i.category === 'stone-dice');
console.log('Stone dice in backup:', stone.length);
stone.forEach(i => console.log('  "' + i.title + '" author="' + i.author + '" imgs=' + (i.images ? i.images.length : 1)));

const cs = items.filter(i => i.category === 'citadel-skaven');
console.log('\nCitadel Skaven in backup:', cs.length);
cs.forEach(i => console.log('  "' + i.title + '" author="' + i.author + '"'));

// Check all dice categories counts
const diceCats = ['stone-dice','metal-dice','resin-dice','acrylic-dice','wooden-dice','acrylic-figurines','metal-figurines'];
console.log('\nDice categories in backup:');
diceCats.forEach(cat => {
  const match = items.filter(i => i.section === 'dice' && i.category === cat);
  console.log('  ' + cat + ': ' + match.length);
});
