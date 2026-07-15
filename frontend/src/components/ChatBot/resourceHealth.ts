import type { Dispatch } from 'redux';
import { ChatAIActions } from 'actions/ChatAIActions';
import type { ChatResourceHealth } from 'types/Chatbot';
import type { Health, HealthStatusId } from 'types/Health';

type PublishChatResourceHealthParams = {
  clusterName?: string;
  health?: Health;
  namespace: string;
  resourceKind: ChatResourceHealth['resourceKind'];
  resourceName: string;
  status?: HealthStatusId;
};

const resolveHealthStatus = (health?: Health, status?: HealthStatusId): HealthStatusId | undefined => {
  const resolved = status ?? health?.getStatus().id;
  if (!resolved || resolved === 'NA') {
    return undefined;
  }

  return resolved;
};

export const publishChatResourceHealth = (dispatch: Dispatch, params: PublishChatResourceHealthParams): void => {
  dispatch(
    ChatAIActions.setResourceHealth({
      clusterName: params.clusterName,
      namespace: params.namespace,
      resourceKind: params.resourceKind,
      resourceName: params.resourceName,
      status: resolveHealthStatus(params.health, params.status)
    })
  );
};

export const clearChatResourceHealth = (dispatch: Dispatch): void => {
  dispatch(ChatAIActions.clearResourceHealth());
};
