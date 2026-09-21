import { expect, type Page, type Response } from '@playwright/test';
import {
  createMockStreamResponse,
  createMockStreamResponseNoEnd,
  createMockStreamResponseWithError,
  mockPayload,
  SECOND_PROVIDER_NAME,
  type MockStreamPayload
} from './aiChatbotMocks';

export type ChatRequestCapture = {
  body?: { conversation_id?: string; interaction_mode?: string; query?: string };
  method?: string;
  provider?: string;
  status?: number;
  url?: string;
};

const SSE_HEADERS = { 'Content-Type': 'text/event-stream' };

function providerFromChatUrl(url: string): string | undefined {
  const match = url.match(/\/api\/chat\/([^/]+)\//);
  return match?.[1];
}

/**
 * Route POST chat AI endpoints with an SSE mock body.
 * Optional `capture` records the last matching request for conversation_id / provider assertions.
 */
export async function mockChatAiResponse(
  page: Page,
  payload: MockStreamPayload = mockPayload,
  options: {
    capture?: ChatRequestCapture;
    status?: number;
    streamBody?: string;
    urlPattern?: string | RegExp;
  } = {}
): Promise<void> {
  const urlPattern = options.urlPattern ?? '**/api/chat/**/ai';
  await page.route(urlPattern, async route => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    const url = request.url();
    let body: ChatRequestCapture['body'];
    try {
      body = request.postDataJSON() as ChatRequestCapture['body'];
    } catch {
      body = undefined;
    }

    if (options.capture) {
      options.capture.body = body;
      options.capture.method = request.method();
      options.capture.provider = providerFromChatUrl(url);
      options.capture.url = url;
      options.capture.status = options.status ?? 200;
    }

    if (options.status !== undefined && options.status !== 200) {
      await route.fulfill({ status: options.status, json: {} });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: SSE_HEADERS,
      body: options.streamBody ?? createMockStreamResponse(payload)
    });
  });
}

export async function mockChatAiStreamNoEnd(page: Page, payload: MockStreamPayload): Promise<void> {
  await mockChatAiResponse(page, payload, { streamBody: createMockStreamResponseNoEnd(payload) });
}

export async function mockChatAiStreamError(page: Page, errorMessage: string): Promise<void> {
  await mockChatAiResponse(
    page,
    {},
    {
      streamBody: createMockStreamResponseWithError(errorMessage)
    }
  );
}

export async function mockChatAiServerError(page: Page): Promise<void> {
  await mockChatAiResponse(page, {}, { status: 500 });
}

/**
 * Inject a second AI provider into `/api/config` before navigation so Redux loads both providers.
 */
export async function injectSecondAiProviderInConfig(page: Page, providerName = SECOND_PROVIDER_NAME): Promise<void> {
  await page.route('**/api/config', async route => {
    const response = await route.fetch();
    const body = await response.json();
    const chatAI = body.chatAI;
    if (!chatAI?.providers?.length) {
      await route.fulfill({ response, json: body });
      return;
    }
    if (chatAI.providers.some((p: { name: string }) => p.name === providerName)) {
      await route.fulfill({ response, json: body });
      return;
    }

    const first = chatAI.providers[0];
    const models =
      Array.isArray(first.models) && first.models.length > 0
        ? first.models
        : [{ name: 'test-model', model: 'test-model', description: 'test-model' }];

    chatAI.providers = [
      ...chatAI.providers,
      {
        name: providerName,
        description: first.description ?? 'Second test provider',
        defaultModel: models[0].name,
        models
      }
    ];
    await route.fulfill({ response, json: body });
  });
}

export async function waitForChatAiPost(page: Page, timeout = 15_000): Promise<Response> {
  return page.waitForResponse(
    response =>
      response.url().includes('/api/chat/') && response.url().endsWith('/ai') && response.request().method() === 'POST',
    { timeout }
  );
}

export async function mockDestinationRuleCreate(page: Page, capture?: ChatRequestCapture): Promise<void> {
  await page.route('**/api/namespaces/bookinfo/istio/networking.istio.io/v1/DestinationRule', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (capture) {
      capture.method = route.request().method();
      capture.status = 200;
      capture.url = route.request().url();
    }
    await route.fulfill({ status: 200, json: {} });
  });
}

export async function expectIstioYamlApply(
  page: Page,
  method: 'POST' | 'PATCH' | 'DELETE',
  urlSubstring: string
): Promise<void> {
  const response = await page.waitForResponse(
    res => res.request().method() === method && res.url().includes(urlSubstring) && res.status() === 200,
    { timeout: 15_000 }
  );
  expect(response.request().method()).toBe(method);
  expect(response.status()).toBe(200);
}
