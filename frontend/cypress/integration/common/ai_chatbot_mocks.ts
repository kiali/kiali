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
