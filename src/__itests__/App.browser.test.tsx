import puppeteer from 'puppeteer';

let testBrowser: puppeteer.Browser;
let page: puppeteer.Page;

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
    await page.goto('http://admin:admin@localhost:5003/console/service-graph/bookinfo', { waitUntil: 'networkidle2' });
  });

  it('should load the app', async () => {
    await page.screenshot({ path: 'kiali-browser-test.png' });
  });

  afterAll(async () => {
    await testBrowser.close();
  });
});
