import { http, HttpResponse } from 'msw';
import { ChatRequest, ChatResponse, ChatSessionUsageMetric } from '../../../types/Chatbot';
import { conversationEntries } from './conversations';

const conversationEntryIds = Array.from(conversationEntries.keys());
const conversationIdStore = new Set<string>(conversationEntryIds);
const sessionUsageMetrics: ChatSessionUsageMetric[] = [
  {
    user_id: 'mock-session',
    provider: 'openai',
    model: 'gpt-4.1',
    request_count: 3,
    prompt_tokens: 1240,
    completion_tokens: 488,
    total_tokens: 1728,
    since: '2026-05-14T11:30:00Z',
    last_updated: '2026-05-14T11:45:00Z'
  },
  {
    user_id: 'mock-session',
    provider: 'google',
    model: 'gemini-2.5-pro',
    request_count: 1,
    prompt_tokens: 315,
    completion_tokens: 92,
    total_tokens: 407,
    since: '2026-05-14T11:48:00Z',
    last_updated: '2026-05-14T11:48:00Z'
  }
];

const buildDefaultResponse = (chatRequest: ChatRequest, provider: string, model: string): ChatResponse => {
  const query = chatRequest.query.trim();

  return {
    answer: query
      ? `Mock response for "${query}". Ask me about namespaces, workloads, or traffic.`
      : 'Mock response ready. Ask me about namespaces, workloads, or traffic.',
    actions: [
      {
        title: 'Open Overview',
        kind: 'navigation',
        payload: '/overview'
      }
    ],
    referenced_docs: [
      {
        doc_url: 'https://kiali.io',
        doc_title: 'Kiali Documentation'
      }
    ],
    used_models: {
      completion_model: model,
      embedding_model: `${provider}-embeddings`
    }
  };
};

const buildChatResponse = (chatRequest: ChatRequest, provider: string, model: string): ChatResponse => {
  const requestedConversation = conversationEntries.get(chatRequest.query.trim());
  if (!requestedConversation) {
    return buildDefaultResponse(chatRequest, provider, model);
  }

  return {
    ...requestedConversation,
    answer: typeof requestedConversation.answer === 'string' ? requestedConversation.answer : '',
    actions: requestedConversation.actions ?? [],
    referenced_docs: requestedConversation.referenced_docs ?? [],
    used_models: {
      completion_model: requestedConversation.used_models?.completion_model ?? model,
      embedding_model: requestedConversation.used_models?.embedding_model ?? `${provider}-embeddings`
    }
  };
};

export const chatbotHandlers = [
  http.post('*/api/chat/:provider/:model/ai', async ({ params, request }) => {
    const body = (await request.json()) as ChatRequest;
    if (body.conversation_id) {
      conversationIdStore.add(body.conversation_id);
    }

    const provider = String(params.provider ?? 'mock');
    const model = String(params.model ?? 'mock-model');

    return HttpResponse.json(buildChatResponse(body, provider, model));
  }),

  http.get('*/api/chat/conversations', () => {
    return HttpResponse.json(Array.from(conversationIdStore));
  }),

  http.get('*/api/chat/session/usage', () => {
    return HttpResponse.json(sessionUsageMetrics);
  }),

  http.delete('*/api/chat/conversations', ({ request }) => {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get('conversationIDs');
    if (idsParam) {
      idsParam
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .forEach(id => conversationIdStore.delete(id));
    }
    return HttpResponse.json({});
  })
];
