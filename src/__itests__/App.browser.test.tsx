import puppeteer, { LoadEvent } from 'puppeteer';

let testBrowser: puppeteer.Browser;
let page: puppeteer.Page;

const host = 'localhost';
const port = 5003;
const username = 'admin';
const password = 'admin';

const getUrl = () => {
  return 'http://' + host + ':' + port;
};

const getPath = (key: string) => {
  return { path: `itest_img/kiali_${key}_test.png` };
};

const kialiPages = {
  graph: `${getUrl()}/console/graph/all`,
  services: `${getUrl()}/console/services`,
  services_review: `${getUrl()}/console/namespaces/istio-system/services/reviews`,
  reviews_metrics: `${getUrl()}/console/namespaces/istio-system/services/reviews?tab=metrics`,
  istio: `${getUrl()}/console/istio`,
  istio_promhttp_rules: `${getUrl()}/console/namespaces/istio-system/istio/rules/promhttp`,
  jaeger: `${getUrl()}/console/jaeger`
};

const kialiUrlPage = (key: string) => {
  return kialiPages[key];
};

const waitToDoScreenshot = () => {
  const loadEvents: LoadEvent[] = ['networkidle0', 'load', 'domcontentloaded'];
  return { waitUntil: loadEvents };
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

  it('kiali-bot-graph', async () => {
    const kialiPage = 'graph';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-services', async () => {
    const kialiPage = 'services';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-services-review', async () => {
    const kialiPage = 'services_review';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-reviews-metrics', async () => {
    const kialiPage = 'reviews_metrics';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-istio', async () => {
    const kialiPage = 'istio';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-istio-promhttp-rules', async () => {
    const kialiPage = 'istio_promhttp_rules';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  it('kiali-bot-jaeger', async () => {
    const kialiPage = 'jaeger';
    await page.goto(kialiUrlPage(kialiPage), waitToDoScreenshot());
    await page.screenshot(getPath(kialiPage));
  });

  afterAll(async () => {
    await testBrowser.close();
  });
});
