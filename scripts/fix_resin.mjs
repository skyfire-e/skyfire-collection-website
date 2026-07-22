import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Fix resin: Seabed got $115 (Sperm's price) — shifted
const resinPrices = {
  'Steampunk Cogs': '18',
  'Space Galaxy': '18',
  'Skyfire': '24',
  'Watermelon': '19',
  'Aquamarine-Black': '26',
  'Fruits': '14',
  'Blood Drops': '21',
  'Seabed': '20',
  'Purple Universe': '25',
  'Cyan Crystal': '25',
  'Liquid Core Eyes': '50',
  'Purple Crystal': '30',
  'Resin Prototype d6 Die': '5',
  'Green Dragon Eye': '25',
  '6d6 3d printed Orkish dice': '7'
};

// Fix the second "Led Lighted" separately (20)
const resin = items.filter(i => i.category === 'resin-dice');
let ldCount = 0;
resin.forEach(item => {
  if (resinPrices[item.title]) {
    item.price = resinPrices[item.title];
  } else if (item.title === 'Led Lighted') {
    ldCount++;
    item.price = ldCount === 1 ? '11' : '20';
  }
});

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');
console.log('Fixed resin prices');
console.log('Total: ' + items.length);

// Verify
const resin2 = items.filter(i => i.category === 'resin-dice');
resin2.forEach((i, idx) => console.log('  ' + (idx+1) + '. "' + i.title.substring(0,30) + '" $' + i.price));
