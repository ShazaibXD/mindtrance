/* Copies the few browser files the app needs from node_modules into vendor/, so the site stays static,
 * works from file:// and satisfies the same-origin Content-Security-Policy. Run: npm run vendor */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = [
  ['lenis/dist/lenis.min.js', 'lenis.min.js'],
  ['lenis/dist/lenis.css', 'lenis.css'],
  ['gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['three/build/three.min.js', 'three.min.js'],
  ['vanta/dist/vanta.net.min.js', 'vanta.net.min.js'],
];
fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, 'node_modules', from), path.join(root, 'vendor', to));
  console.log('vendor/' + to);
}
