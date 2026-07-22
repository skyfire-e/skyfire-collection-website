import http from 'http';

const BASE = 'http://localhost:3000';

const priceMap = {
  'Necromancer set': 102,
  'Vortex Bronze': 175,
  'Floating Bronze': 200,
  'Silver d100': 40,
  'Ancient Golden d100': 30,
  'Dragon Scale d60': 26,
  'Pioneer Martian Dice': 144,
  'Aztec Gods': 100,
  'Arcanum set copy': 20,
  'Dice Sword': 10,
  'DnD Class Coins': 10,
  'Red Steampunk Spheres': 60,
  'Golden Atoms': 80,
  'Spiky Dragon-themed': 25,
};

const loginReq = http.request(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    http.get(BASE + '/api/items?section=dice&category=metal-figurines', { headers: { Cookie: cookies } }, (r2) => {
      let d = '';
      r2.on('data', c => d += c);
      r2.on('end', () => {
        const items = JSON.parse(d);
        let done = 0, errors = 0;
        function next(i) {
          if (i >= items.length) {
            console.log('\nDone. Updated ' + done + (errors ? ', ' + errors + ' unmatched' : ''));
            return;
          }
          const item = items[i];
          const price = priceMap[item.title];
          if (price === undefined) {
            console.log('NO MATCH: "' + item.title + '"');
            errors++;
            next(i + 1);
            return;
          }
          const fd = JSON.stringify({ price });
          const req = http.request(BASE + '/api/items/' + item.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies },
          }, (r3) => {
            let d2 = '';
            r3.on('data', c => d2 += c);
            r3.on('end', () => {
              const r = JSON.parse(d2);
              console.log((done+1) + '. ' + r.title + ' $' + r.price);
              done++;
              next(i + 1);
            });
          });
          req.write(fd);
          req.end();
        }
        next(0);
      });
    });
  });
});
loginReq.write(JSON.stringify({ username: 'admin', password: 'admin123' }));
loginReq.end();
