import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Price data from the Google Sheets (by position within each category)
const prices = {
  'stone-dice': [
    90, 90, 89, 50, 99, 14
  ],
  'metal-dice': [
    40, 61, 71, 40, 35, 60, 77, 18, 18, 52, 52, 52, 80, 60, 26, 40, 50, 35, 19, 20, 45, 20, 35, 30, 20, 20, 35, 35, 15, 30
  ],
  'wooden-dice': [
    44, 70
  ],
  'acrylic-dice': [
    5, 20, 6, 12, 12, 11, 11, 5, 16, 1, 1, 1, 1, 1, 1, 29, 29, 27, 1, 20, 2, 4, 2, 2, 2, 2, 2, 2, 2, 3, 4, 2, 2, 4, 5, 6, 10, 15, 10, 20, 40, 20, 60, 40, 50, 1, 2, 150, 20, 100, 100, 80, 100, 60, 60, 20, 0, 0, 60, 10
  ],
  'acrylic-figurines': [
    15, 15, 35, 48, 25, 25, 25, 35, 19, 19, 19, 9, 9, 9, 9
  ],
  'metal-figurines': [
    102, 175, 200, 40, 30, 26, 144, 100, 20, 10, 10, 60, 80, 25
  ],
  'resin-dice': [
    18, 18, 24, 19, 26, 14, 21, 11, 115, 20, 20, 25, 25, 50, 30, 5, 7, 25
  ]
};

const catOrder = ['stone-dice','metal-dice','resin-dice','acrylic-dice','wooden-dice','acrylic-figurines','metal-figurines'];

let setCount = 0;
let mismatchCount = 0;

catOrder.forEach(cat => {
  const catItems = items.filter(i => i.category === cat);
  const catPrices = prices[cat] || [];
  console.log(cat + ': ' + catItems.length + ' items, ' + catPrices.length + ' prices');
  if (catItems.length !== catPrices.length) {
    console.log('  MISMATCH! items=' + catItems.length + ' prices=' + catPrices.length);
    mismatchCount++;
  }
  catItems.forEach((item, idx) => {
    if (idx < catPrices.length) {
      item.price = catPrices[idx].toString();
      setCount++;
    }
  });
});

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');
console.log('\nSet prices for ' + setCount + ' items');
console.log('Mismatches: ' + mismatchCount);

// Show first few items with prices for verification
items.filter(i => i.section === 'dice').slice(0, 8).forEach(i => {
  console.log(i.category + ': ' + i.title.substring(0,40) + ' | $' + i.price);
});
