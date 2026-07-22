import http from 'http';

const BASE = 'http://localhost:3000';

// Prices from user's table, mapped by position (order matches the Google Sites page)
// Table has 60 rows (with duplicate #47), all 60 items have prices
const prices = [
  5.00,   // 1.  Andromeda
  20.00,  // 2.  Dwarven Red and Black : d4 2d6 d8 2d10 d12
  6.00,   // 3.  Celtic White d4 and Green d4
  12.00,  // 4.  Blue, Pink, and Yellow Marble
  12.00,  // 5.  Red color spray
  11.00,  // 6.  Translucent Blue & Red
  11.00,  // 7.  Classic Pearl & Red
  5.00,   // 8.  Standard Black
  16.00,  // 9.  Cyberpunk Red
  1.00,   // 10. Standard Orange
  1.00,   // 11. Standard Green + Blue
  1.00,   // 12. Standard Green + Black
  1.00,   // 13. Standard Blue with dots
  1.00,   // 14. Standard Blue + Black
  1.00,   // 15. Standard Blue + White
  29.00,  // 16. Witcher Geralt
  29.00,  // 17. Witcher Yennefer Dice set
  27.00,  // 18. Qworkshop Bone Dice Macabre
  1.00,   // 19. Dark Green
  20.00,  // 20. Sicarius (Smoke)
  2.00,   // 21. Honey Reddish
  4.00,   // 22. 10d8 Blue marble-like
  2.00,   // 23. Transparent Green
  2.00,   // 24. Transparent Green-purple
  2.00,   // 25. Standard Coffee
  2.00,   // 26. Green marble-like
  2.00,   // 27. Yellow marble-like
  2.00,   // 28. 50pcs small 8mm d6
  2.00,   // 29. Standard Nutella
  3.00,   // 30. Teal marble-like
  4.00,   // 31. Standard White + Blue
  2.00,   // 32. Honey + Glitter
  2.00,   // 33. Standard Bloody
  4.00,   // 34. 10d8 Yellow Marble-like
  5.00,   // 35. Barbie Pink
  6.00,   // 36. d1-100 Green
  10.00,  // 37. Rainbow
  15.00,  // 38. Gold coated
  10.00,  // 39. Mini-sized
  20.00,  // 40. Dragon Eye d20 5pc set
  40.00,  // 41. Witcher Cat School by q workshop
  20.00,  // 42. Witcher Triss Beautiful Healer
  60.00,  // 43. Games Workshop Orks Dice 7 edition 20d6
  40.00,  // 44. Games Workshop Orks Dice 9 edition 20d6
  50.00,  // 45. Games Workshop Orks Kill Team Dice 20d6
  1.00,   // 46. Various Un-set
  2.00,   // 47. Classic 5d6
  150.00, // 47. Games Workshop Skaven 2019 Dice 20d6
  20.00,  // 48. Games Workshop Skaven Bloodbowl
  100.00, // 49. Games Workshop Death Guard Dice 20d6
  100.00, // 50. Games Workshop Gloomspite Gitz Squig Dice 20d6
  80.00,  // 51. Games Workshop Necrons Dice 20d6
  100.00, // 52. Games Workshop End Times Skaven Dice 10d6
  60.00,  // 53. Games Workshop Ork Flyboyz Dice 20d6
  60.00,  // 54. Games Workshop Skaven Bloodbowl Warpstone Green
  20.00,  // 55. Games Workshop Snotling Bloodbowl
  0.00,   // 56. Witcher Huge D6 by q workshop
  0.00,   // 57. Standard d6
  60.00,  // 58. Games Workshop Gloomspite Gitz Dice 20d6
  10.00,  // 59. Helloween by cusdie
];

const loginReq = http.request(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    
    http.get(BASE + '/api/items?section=dice&category=acrylic-dice', { headers: { Cookie: cookies } }, (r2) => {
      let d = '';
      r2.on('data', c => d += c);
      r2.on('end', () => {
        const items = JSON.parse(d);
        console.log('Total items: ' + items.length + ', prices: ' + prices.length);

        let idx = 0;
        function next() {
          if (idx >= items.length) {
            console.log('\nAll done! Updated ' + items.length + ' prices.');
            return;
          }
          const item = items[idx];
          const fd = JSON.stringify({ price: prices[idx] });
          const req = http.request(BASE + '/api/items/' + item.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies },
          }, (r3) => {
            let d2 = '';
            r3.on('data', c => d2 += c);
            r3.on('end', () => {
              const r = JSON.parse(d2);
              console.log((idx+1) + '. ' + r.title + ' $' + r.price + (r.price != prices[idx] ? ' MISMATCH!' : ''));
              idx++;
              next();
            });
          });
          req.write(fd);
          req.end();
        }
        next();
      });
    });
  });
});
loginReq.write(JSON.stringify({ username: 'admin', password: 'admin123' }));
loginReq.end();
