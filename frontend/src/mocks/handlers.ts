// Combine all mock handlers
import { authHandlers } from './handlers/auth';
import { chatbotHandlers } from './handlers/chatbot/chatbot';
import { configHandlers } from './handlers/config';
import { healthHandlers } from './handlers/health';
import { istioHandlers } from './handlers/istio';
import { meshHandlers } from './handlers/mesh';
import { namespaceHandlers } from './handlers/namespaces';
import { statusHandlers } from './handlers/status';
import { tracingHandlers } from './handlers/tracing';
import { trafficHandlers } from './handlers/traffic';
import { workloadHandlers } from './handlers/workloads';

export const handlers = [
  ...authHandlers,
  ...chatbotHandlers,
  ...configHandlers,
  ...healthHandlers,
  ...istioHandlers,
  ...meshHandlers,
  ...namespaceHandlers,
  ...statusHandlers,
  ...tracingHandlers,
  ...trafficHandlers,
  ...workloadHandlers
];
