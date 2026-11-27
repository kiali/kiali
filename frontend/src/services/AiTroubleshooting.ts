import type { Dispatch } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppAction } from 'actions/KialiAppAction';
import type { ApiError } from 'types/Api';
import type { TroubleshootingIssue } from 'types/Chatbot';
import * as API from 'services/Api';

// Loads the mesh scan into Redux so pages other than the AI Dashboard can read it.
// isCurrent lets a caller drop the result when the user opened an analysis modal
// while the request was still in flight.
export const loadTroubleshootingScan = async (
  dispatch: Dispatch<KialiAppAction>,
  isCurrent: () => boolean = () => true
): Promise<void> => {
  try {
    const response = await API.getAITroubleshooting();
    if (!isCurrent()) {
      return;
    }
    const data = response.data as TroubleshootingIssue[] | { issues?: TroubleshootingIssue[] } | undefined;
    const issues = Array.isArray(data) ? data : (data?.issues ?? []);
    dispatch(ChatAIActions.setTroubleshootingIssues(issues));
  } catch (err) {
    if (!isCurrent()) {
      return;
    }
    dispatch(ChatAIActions.setTroubleshootingError(API.getErrorString(err as ApiError)));
  }
};
