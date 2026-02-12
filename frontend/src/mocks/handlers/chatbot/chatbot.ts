import { http, HttpResponse } from 'msw';
import { ChatRequest, ChatResponse } from '../../../types/Chatbot';
import { conversationEntries } from './conversations';

const conversationEntryIds = Array.from(conversationEntries.keys());
const conversationIdStore = new Set<string>(conversationEntryIds);

const buildDefaultResponse = (chatRequest: ChatRequest, _: string, __: string): ChatResponse => {
  const query = chatRequest.query.trim();

  return {
    response: query
      ? `Mock response for "${query}". Ask me about namespaces, workloads, or traffic.`
      : 'Mock response ready. Ask me about namespaces, workloads, or traffic.',
    actions: [
      {
        title: 'Open Overview',
        kind: 'navigation',
        payload: '/overview'
      }
    ],
    referenced_documents: [
      {
        doc_url: 'https://kiali.io',
        doc_title: 'Kiali Documentation',
      }
    ],
    tool_calls: [],
    tool_results: [],
    truncated: false,
    error: undefined,
    available_quotas: {},
    conversation_id: '312312312',
    input_tokens: 0,
    output_tokens: 0
  };
};

const buildChatResponse = (chatRequest: ChatRequest, provider: string, model: string): ChatResponse => {
  const requestedConversation = conversationEntries.get(chatRequest.query.trim());
  if (!requestedConversation) {
    return buildDefaultResponse(chatRequest, provider, model);
  }

  return {
    ...requestedConversation,
    response: typeof requestedConversation.response === 'string' ? requestedConversation.response : '',
    actions: requestedConversation.actions ?? [],
    referenced_documents: requestedConversation.referenced_documents ?? [],
    tool_calls: requestedConversation.tool_calls ?? [],
    tool_results: requestedConversation.tool_results ?? [],
    truncated: requestedConversation.truncated ?? false,
    error: requestedConversation.error ?? undefined,
    available_quotas: requestedConversation.available_quotas ?? {},
    conversation_id: requestedConversation.conversation_id ?? '',
    input_tokens: requestedConversation.input_tokens ?? 0,
    output_tokens: requestedConversation.output_tokens ?? 0
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
