// Combine all mock handlers
import { appHandlers } from './handlers/apps';
import { authHandlers } from './handlers/auth';
import { chatbotHandlers } from './handlers/chatbot/chatbot';
import { statsHandlers } from './handlers/chatbot/stats';
import { configHandlers } from './handlers/config';
import { healthHandlers } from './handlers/health';
import { istioHandlers } from './handlers/istio';
import { meshHandlers } from './handlers/mesh';
import { namespaceHandlers } from './handlers/namespaces';
import { overviewHandlers } from './handlers/overview';
import { podHandlers } from './handlers/pods';
import { serviceHandlers } from './handlers/services';
import { statusHandlers } from './handlers/status';
import { tracingHandlers } from './handlers/tracing';
import { trafficHandlers } from './handlers/traffic';
import { workloadHandlers } from './handlers/workloads';

export const handlers = [
  ...appHandlers,
  ...authHandlers,
  ...chatbotHandlers,
  ...statsHandlers,
  ...configHandlers,
  ...healthHandlers,
  ...istioHandlers,
  ...meshHandlers,
  ...namespaceHandlers,
  ...overviewHandlers,
  ...podHandlers,
  ...serviceHandlers,
  ...statusHandlers,
  ...tracingHandlers,
  ...trafficHandlers,
  ...workloadHandlers
];
