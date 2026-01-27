import { http, HttpResponse } from 'msw';
import { ChatRequest, ChatResponse } from '../../../types/Chatbot';
import { conversationEntries } from './conversations';

const conversationEntryIds = Array.from(conversationEntries.keys());
const conversationIdStore = new Set<string>(conversationEntryIds);

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
    citations: [
      {
        link: 'https://kiali.io',
        title: 'Kiali Documentation',
        body: 'Kiali provides observability and management for Istio-based service meshes.'
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
    citations: requestedConversation.citations ?? [],
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
