import { ChatAIActions } from 'actions/ChatAIActions';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import type { KialiAppState } from 'store/Store';
import type { StartTroubleshootingConversationPayload, TroubleshootingConversation } from 'types/Chatbot';

const EMPTY_CONVERSATIONS: TroubleshootingConversation[] = [];

export const isTroubleshootingAnalyzeAllowed = (state: KialiAppState): boolean => {
  const troubleshooting = state.ai.troubleshooting;
  return Boolean(
    state.ai.enabled &&
    troubleshooting?.enabled &&
    troubleshooting?.allowed &&
    troubleshooting?.ai_support?.enabled &&
    troubleshooting?.ai_support?.allowed
  );
};

export type TroubleshootingDrawerApi = {
  activeConversation?: TroubleshootingConversation;
  close: () => void;
  conversations: TroubleshootingConversation[];
  expanded: boolean;
  select: (id: string) => void;
  start: (payload: StartTroubleshootingConversationPayload) => void;
  toggle: () => void;
};

// Drawer open state and conversation history live in ai.troubleshooting so any page can open the same panel.
export const useTroubleshootingDrawer = (): TroubleshootingDrawerApi => {
  const dispatch = useKialiDispatch();
  const activeConversationId = useKialiSelector(state => state.ai.troubleshooting.activeConversationId);
  const conversations = useKialiSelector(state => state.ai.troubleshooting.conversations) ?? EMPTY_CONVERSATIONS;
  const expanded = useKialiSelector(state => !!state.ai.troubleshooting.drawerExpanded);
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId);

  return {
    activeConversation,
    close: () => dispatch(ChatAIActions.setTroubleshootingDrawerExpanded(false)),
    conversations,
    expanded,
    select: (id: string) => dispatch(ChatAIActions.selectTroubleshootingConversation(id)),
    start: (payload: StartTroubleshootingConversationPayload) =>
      dispatch(ChatAIActions.startTroubleshootingConversation(payload)),
    toggle: () => dispatch(ChatAIActions.toggleTroubleshootingDrawer())
  };
};
