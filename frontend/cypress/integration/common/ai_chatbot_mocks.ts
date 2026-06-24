export const mockPayload = {
  answer:
    "Of course. I've just surfaced the relevant documentation for you in the UI.\n\nIn a nutshell, a **VirtualService** is an Istio configuration resource that defines the rules for how requests are routed to services within the service mesh.",
  referenced_docs: [
    {
      doc_title: 'Configuring Request Timeouts',
      doc_url: 'https://istio.io/latest/docs/tasks/traffic-management/request-timeouts/'
    },
    {
      doc_title: 'Istio Traffic Shifting (Canary Rollouts)',
      doc_url: 'https://istio.io/latest/docs/tasks/traffic-management/traffic-shifting/'
    }
  ]
};

export const singleActionPayload = {
  actions: [
    {
      title: 'View services List',
      kind: 'navigation',
      payload: '/services?namespaces=bookinfo'
    }
  ],
  answer: "I'm taking you to the services list for the bookinfo namespace now.\n"
};

export const multipleActionsPayload = {
  actions: [
    {
      title: 'View services List',
      kind: 'navigation',
      payload: '/services?namespaces=bookinfo'
    },
    {
      title: 'View services List mocked',
      kind: 'navigation',
      payload: '/services?namespaces=bookinfo'
    }
  ],
  answer: "I'm taking you to the services list for the bookinfo namespace now.\n"
};

export const autoNavigatePayload = {
  actions: [
    {
      title: 'View services List',
      kind: 'navigation',
      payload: '/services?namespaces=bookinfo'
    }
  ],
  answer: 'Sure, I can navigate you to the services in the bookinfo namespace.'
};

/** Payload used to test stream cancellation — no `end` event keeps isStreaming:true. */
export const cancelledStreamPayload = {
  answer: 'This response is being streamed and will be cancelled.'
};

/**
 * Like createMockStreamResponse but omits the `end` event.
 * This leaves the Redux chat entry with isStreaming:true after the response body is
 * consumed, which keeps the stop button visible so Cypress can click it.
 */
export function createMockStreamResponseNoEnd(payload: any): string {
  let stream = '';
  stream += `data: ${JSON.stringify({ event: 'start', data: { conversation_id: 'mock-conv-id' } })}\n\n`;
  if (payload.answer) {
    const tokens = payload.answer.match(/(\S+|\s+)/g) || [];
    tokens.forEach((token: string, i: number) => {
      stream += `data: ${JSON.stringify({ event: 'token', data: { ID: i, token: token } })}\n\n`;
    });
  }
  // No end event — isStreaming stays true so the stop button remains visible
  return stream;
}

export function createMockStreamResponse(payload: any): string {
  let stream = '';
  // start
  stream += `data: ${JSON.stringify({ event: 'start', data: { conversation_id: 'mock-conv-id' } })}\n\n`;

  // tool_call events (optional) — each entry has { name, id, args? }
  if (payload.toolCalls) {
    for (const call of payload.toolCalls as Array<{ args?: Record<string, unknown>; id: string; name: string }>) {
      stream += `data: ${JSON.stringify({
        event: 'tool_call',
        data: { args: call.args ?? {}, id: call.id, name: call.name, type: 'tool_call' }
      })}\n\n`;
    }
  }

  // tool_result events (optional) — each entry has { id, content, status }
  if (payload.toolResults) {
    for (const result of payload.toolResults as Array<{ content: string; id: string; status: string }>) {
      stream += `data: ${JSON.stringify({
        event: 'tool_result',
        data: { content: result.content, id: result.id, round: 1, status: result.status, type: 'tool_result' }
      })}\n\n`;
    }
  }

  // token events
  if (payload.answer) {
    const tokens = payload.answer.match(/(\S+|\s+)/g) || [];
    tokens.forEach((token: string, i: number) => {
      stream += `data: ${JSON.stringify({ event: 'token', data: { ID: i, token: token } })}\n\n`;
    });
  }

  // end
  stream += `data: ${JSON.stringify({
    event: 'end',
    data: {
      actions: payload.actions || [],
      referenced_documents: payload.referenced_docs || [],
      truncated: false
    }
  })}\n\n`;

  return stream;
}

const virtualServiceYamlCreate = `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: vs-ai-cypress
  namespace: bookinfo
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
`;

const virtualServiceYamlPatch = `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: vs-ai-cypress
  namespace: bookinfo
spec:
  hosts:
    - reviews
  http:
    - timeout: 2s
      route:
        - destination:
            host: reviews
`;

const virtualServiceYamlDelete = `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: vs-ai-cypress
  namespace: bookinfo
spec:
  hosts:
    - reviews
`;

// Two-file payload: DestinationRule + VirtualService for traffic-shifting tests
const destinationRuleYaml = `apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
  namespace: bookinfo
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
`;

const virtualServiceYaml = `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: bookinfo
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
      weight: 80
    - destination:
        host: reviews
        subset: v2
      weight: 20
`;

export const multiFileActionsPayload = {
  answer: 'Here is the configuration to apply traffic shifting for the reviews service.',
  actions: [
    {
      kind: 'file',
      title: 'Preview of files to create',
      fileName: 'dr_reviews.yaml',
      operation: 'create',
      namespace: 'bookinfo',
      group: 'networking.istio.io',
      version: 'v1',
      kindName: 'DestinationRule',
      object: 'reviews',
      payload: destinationRuleYaml
    },
    {
      kind: 'file',
      title: 'Preview of files to create',
      fileName: 'vs_reviews.yaml',
      operation: 'create',
      namespace: 'bookinfo',
      group: 'networking.istio.io',
      version: 'v1',
      kindName: 'VirtualService',
      object: 'reviews',
      payload: virtualServiceYaml
    }
  ]
};

export const fileCreateYamlPayload = {
  answer: 'Here is a VirtualService you can create in bookinfo.',
  actions: [
    {
      kind: 'file',
      title: 'Create VirtualService',
      fileName: 'vs-ai-cypress.yaml',
      operation: 'create',
      namespace: 'bookinfo',
      group: 'networking.istio.io',
      version: 'v1',
      kindName: 'VirtualService',
      object: 'vs-ai-cypress',
      payload: virtualServiceYamlCreate
    }
  ]
};

export const filePatchYamlPayload = {
  answer: 'Apply this patch to the existing VirtualService.',
  actions: [
    {
      kind: 'file',
      title: 'Patch VirtualService',
      fileName: 'vs-ai-cypress.yaml',
      operation: 'patch',
      namespace: 'bookinfo',
      group: 'networking.istio.io',
      version: 'v1',
      kindName: 'VirtualService',
      object: 'vs-ai-cypress',
      payload: virtualServiceYamlPatch
    }
  ]
};

// ────────────────────────────────────────────────────────────────────────────
// Tool-call / tool-result payloads
// ────────────────────────────────────────────────────────────────────────────

/** Only tool_call — no tool_result — so the tool stays in isRunning:true state. */
export const toolRunningPayload = {
  toolCalls: [{ name: 'get_mesh_status', id: 'tc-running-1', args: {} }]
};

/** tool_call + successful tool_result (no args). */
export const toolSuccessPayload = {
  toolCalls: [{ name: 'get_mesh_status', id: 'tc-success-1', args: {} }],
  toolResults: [{ id: 'tc-success-1', content: '{"status":"Healthy"}', status: 'success' }],
  answer: 'Your mesh is healthy.'
};

/** tool_call + error tool_result. */
export const toolErrorPayload = {
  toolCalls: [{ name: 'get_logs', id: 'tc-error-1', args: {} }],
  toolResults: [{ id: 'tc-error-1', content: 'Error fetching logs: permission denied', status: 'error' }],
  answer: 'I encountered an error fetching the logs.'
};

/** tool_call with arguments + successful tool_result. */
export const toolWithArgsPayload = {
  toolCalls: [
    {
      name: 'list_or_get_resources',
      id: 'tc-args-1',
      args: { namespaces: 'bookinfo', resourceType: 'service' }
    }
  ],
  toolResults: [
    {
      id: 'tc-args-1',
      content: '{"services":["productpage","reviews","ratings","details"]}',
      status: 'success'
    }
  ],
  answer: 'Here are the services running in the bookinfo namespace.'
};

/**
 * Produces a minimal SSE stream that contains a single `error` event instead of a
 * successful `end` event.  Used to test the in-stream error handling path inside
 * Prompt.tsx (the `json.event === 'error'` branch).
 */
export function createMockStreamResponseWithError(errorMessage: string): string {
  let stream = '';
  stream += `data: ${JSON.stringify({ event: 'start', data: { conversation_id: 'mock-error-id' } })}\n\n`;
  stream += `data: ${JSON.stringify({ event: 'error', data: errorMessage })}\n\n`;
  return stream;
}

export const fileDeleteYamlPayload = {
  answer: 'Confirm deletion of this VirtualService.',
  actions: [
    {
      kind: 'file',
      title: 'Delete VirtualService',
      fileName: 'vs-ai-cypress.yaml',
      operation: 'delete',
      namespace: 'bookinfo',
      group: 'networking.istio.io',
      version: 'v1',
      kindName: 'VirtualService',
      object: 'vs-ai-cypress',
      payload: virtualServiceYamlDelete
    }
  ]
};
