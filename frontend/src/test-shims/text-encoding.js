'use strict';

// Enzyme → cheerio → undici requires TextDecoder/TextEncoder, which
// jest-environment-jsdom does not always expose as globals.
const { TextDecoder, TextEncoder } = require('util');

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
