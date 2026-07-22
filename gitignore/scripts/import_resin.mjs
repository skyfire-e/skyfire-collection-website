import { readFileSync } from 'fs';

const http = await import('http');
const BASE = 'http://localhost:3000';

const mapping = JSON.parse(readFileSync('resin-dice-mapping.json', 'utf8'));
const items = mapping;

// Login
const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
const loginReq = http.request(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    console.log(`Logged in, ${items.length} items to import\n`);
    postItem(0, cookies);
  });
});
loginReq.write(loginData);
loginReq.end();

function postItem(idx, cookies) {
  if (idx >= items.length) {
    console.log('\nAll items imported!');
    return;
  }

  const item = items[idx];
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const parts = [];

  const fields = [
    { name: 'section', value: 'dice' },
    { name: 'category', value: 'resin-dice' },
    { name: 'title', value: item.title },
    { name: 'author', value: item.author },
  ];

  for (const f of fields) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`
    ));
  }

  for (const filename of item.images) {
    const fpath = `uploads/${filename}`;
    const imgData = readFileSync(fpath);
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`
    ));
    parts.push(imgData);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const totalBuffer = Buffer.concat(parts);

  const req = http.request(`${BASE}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalBuffer.length,
      'Cookie': cookies,
    },
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const result = JSON.parse(data);
      console.log(`[${idx+1}/${items.length}] ${item.title}${item.author ? ' (' + item.author + ')' : ''} \u2192 ID ${result.id}`);
      postItem(idx + 1, cookies);
    });
  });
  req.write(totalBuffer);
  req.end();
}
