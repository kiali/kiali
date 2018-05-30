import puppeteer from 'puppeteer';

let testBrowser: puppeteer.Browser;
let page: puppeteer.Page;

const host = 'localhost';
const port = 5003;
const username = 'admin';
const password = 'admin';

const getUrl = () => {
  return 'http://' + host + ':' + port;
};

jest.setTimeout(30000);

describe('browser_smoke', () => {
  beforeAll(async () => {
    testBrowser = await puppeteer.launch({
      headless: true,
      slowMo: 300,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await testBrowser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(getUrl(), { waitUntil: 'load' });
    await page.waitFor('input[name=username]');
    await page.waitFor('input[name=password]');

    await page.type('input[name=username]', username);
    await page.type('input[name=password]', password);

    await page.click('button[type="submit"]');
  });

  afterAll(() => {
    testBrowser.close();
  });

  it('should load the app', async () => {
    await page.screenshot({ path: 'kiali-browser-test.png' });
  });

  afterAll(async () => {
    await testBrowser.close();
  });
});
