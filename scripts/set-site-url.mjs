// Sets the absolute site URL in public/index.html's social-card tags (X/Twitter needs absolute image URLs).
//   node scripts/set-site-url.mjs https://tale-of-the-tape.pages.dev
import fs from 'node:fs';

const url = process.argv[2]?.replace(/\/?$/, '/');
if (!url || !/^https:\/\/[^/]+/.test(url)) {
  console.error('Usage: node scripts/set-site-url.mjs https://your-site.example/');
  process.exit(1);
}
const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');
html = html
  .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${url}og.png$2`)
  .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${url}og.png$2`);
fs.writeFileSync(file, html);
console.log(`Social cards now point at ${url}`);
