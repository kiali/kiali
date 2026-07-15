import { selectChatResourceHealthStatus } from '../hooks/useChatResourceHealth';
import type { PromptContext } from '../promptContext';
import type { KialiAppState } from 'store/Store';
import type { ChatResourceHealth } from 'types/Chatbot';

let mockIsMultiCluster = false;

rstest.mock('config', () => ({
  get isMultiCluster() {
    return mockIsMultiCluster;
  }
}));

const serviceDetailContext: PromptContext = {
  clusterName: 'east',
  isDetailView: true,
  namespace: 'bookinfo',
  resourceKind: 'service',
  resourceName: 'ratings'
};

const buildState = (resourceHealth?: ChatResourceHealth): KialiAppState =>
  ({
    aiChat: {
      resourceHealth
    }
  } as KialiAppState);

describe('selectChatResourceHealthStatus', () => {
  beforeEach(() => {
    mockIsMultiCluster = true;
  });

  it('returns undefined on list views', () => {
    expect(
      selectChatResourceHealthStatus(buildState(), {
        isDetailView: false,
        resourceKind: 'services'
      })
    ).toBeUndefined();
  });

  it('returns stored health when page context matches', () => {
    expect(
      selectChatResourceHealthStatus(
        buildState({
          clusterName: 'east',
          namespace: 'bookinfo',
          resourceKind: 'service',
          resourceName: 'ratings',
          status: 'Degraded'
        }),
        serviceDetailContext
      )
    ).toBe('Degraded');
  });

  it('returns undefined when resource name does not match', () => {
    expect(
      selectChatResourceHealthStatus(
        buildState({
          clusterName: 'east',
          namespace: 'bookinfo',
          resourceKind: 'service',
          resourceName: 'details',
          status: 'Healthy'
        }),
        serviceDetailContext
      )
    ).toBeUndefined();
  });

  it('returns undefined when cluster does not match in multi-cluster environments', () => {
    expect(
      selectChatResourceHealthStatus(
        buildState({
          clusterName: 'west',
          namespace: 'bookinfo',
          resourceKind: 'service',
          resourceName: 'ratings',
          status: 'Healthy'
        }),
        serviceDetailContext
      )
    ).toBeUndefined();
  });
});
