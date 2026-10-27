import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { ChatAIActions } from '../../actions/ChatAIActions';
import {
  AiTroubleshootingStateReducer,
  ChatAiStateReducer,
  INITIAL_CHAT_AI_STATE,
  INITIAL_TROUBLESHOOTING_STATE
} from '../ChatAIState';

const makeAiEntry = (id: string, overrides: Record<string, unknown> = {}): ImmutableMap<string, unknown> =>
  ImmutableMap({
    id,
    who: 'ai',
    text: '',
    isStreaming: false,
    isCancelled: false,
    isTruncated: false,
    tools: ImmutableMap(),
    ...overrides
  });

describe('ChatAiStateReducer', () => {
  describe('setChatHistoryUpdateTool', () => {
    it('merges tool_result into an existing tool without discarding the tool name', () => {
      const entryId = 'entry-1';
      const toolId = 'tc-1';

      // Start: one AI entry with a running tool_call
      const stateWithToolCall = ChatAiStateReducer(
        { ...INITIAL_CHAT_AI_STATE, chatHistory: ImmutableList([makeAiEntry(entryId)]) },
        ChatAIActions.setChatHistoryUpdateTool({
          id: entryId,
          toolID: toolId,
          tool: { name: 'get_mesh_status', args: {}, isRunning: true }
        })
      );

      // Act: receive tool_result (isRunning → false, status set)
      const stateWithToolResult = ChatAiStateReducer(
        stateWithToolCall,
        ChatAIActions.setChatHistoryUpdateTool({
          id: entryId,
          toolID: toolId,
          tool: { content: '{"status":"Healthy"}', isRunning: false, status: 'success' }
        })
      );

      const tool = (stateWithToolResult.chatHistory.getIn([0, 'tools']) as ImmutableMap<string, unknown>).get(
        toolId
      ) as ImmutableMap<string, unknown>;

      expect(tool.get('name')).toBe('get_mesh_status');
      expect(tool.get('isRunning')).toBe(false);
      expect(tool.get('status')).toBe('success');
      expect(tool.get('content')).toBe('{"status":"Healthy"}');
    });
  });

  describe('setChatHistoryUpdateById', () => {
    it('does not mutate history when the target id does not exist', () => {
      const stateWithEntry = ChatAiStateReducer(
        INITIAL_CHAT_AI_STATE,
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'real-entry',
            who: 'ai',
            text: 'hello',
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );

      const stateAfter = ChatAiStateReducer(
        stateWithEntry,
        ChatAIActions.setChatHistoryUpdateById({
          id: 'nonexistent-id',
          entry: { text: 'should not appear' }
        })
      );

      // The chatHistory reference must be identical — no mutation
      expect(stateAfter.chatHistory).toBe(stateWithEntry.chatHistory);
    });
  });

  describe('pendingPrompt', () => {
    it('stores a prompt to send and clears it after the chatbot consumes it', () => {
      const requested = ChatAiStateReducer(
        INITIAL_CHAT_AI_STATE,
        ChatAIActions.setPendingPrompt('Why is this failing?')
      );
      expect(requested.pendingPrompt).toEqual({ nonce: 1, text: 'Why is this failing?' });

      const again = ChatAiStateReducer(requested, ChatAIActions.setPendingPrompt('Why is this failing?'));
      expect(again.pendingPrompt?.nonce).toBe(2);

      const cleared = ChatAiStateReducer(again, ChatAIActions.clearPendingPrompt());
      expect(cleared.pendingPrompt).toBeUndefined();
    });
  });
});

describe('AiTroubleshootingStateReducer', () => {
  const aiConfig = {
    chat: {
      allowed: true,
      defaultProvider: '',
      enabled: true,
      providers: [],
      store: { enabled: false }
    },
    consumption: { allowed: false, enabled: false },
    enabled: true,
    troubleshooting: {
      ai_support: { allowed: false, enabled: false },
      allowed: true,
      enabled: true
    }
  };

  it('stores hidden subproblem ids and keeps them when AI config is refreshed', () => {
    const hidden = AiTroubleshootingStateReducer(
      { ...INITIAL_TROUBLESHOOTING_STATE, hiddenSubProblemIds: [] },
      ChatAIActions.hideTroubleshootingSubProblem('sub-1')
    );
    expect(hidden.hiddenSubProblemIds).toEqual(['sub-1']);

    const again = AiTroubleshootingStateReducer(hidden, ChatAIActions.hideTroubleshootingSubProblem('sub-1'));
    expect(again).toBe(hidden);

    const refreshed = AiTroubleshootingStateReducer(hidden, ChatAIActions.setAI(aiConfig));
    expect(refreshed.hiddenSubProblemIds).toEqual(['sub-1']);
    expect(refreshed.enabled).toBe(true);

    const shown = AiTroubleshootingStateReducer(refreshed, ChatAIActions.showTroubleshootingSubProblem('sub-1'));
    expect(shown.hiddenSubProblemIds).toEqual([]);
  });

  it('stores the troubleshooting scan and keeps it when AI config is refreshed', () => {
    const issues = [
      {
        category: 'data_plane',
        id: 'dp-1',
        problem: 'Reviews is unhealthy',
        subProblems: []
      }
    ];
    const stored = AiTroubleshootingStateReducer(
      INITIAL_TROUBLESHOOTING_STATE,
      ChatAIActions.setTroubleshootingIssues(issues)
    );
    expect(stored.loaded).toBe(true);
    expect(stored.error).toBe('');
    expect(stored.issues).toEqual(issues);

    const failed = AiTroubleshootingStateReducer(stored, ChatAIActions.setTroubleshootingError('unavailable'));
    expect(failed.loaded).toBe(true);
    expect(failed.error).toBe('unavailable');
    expect(failed.issues).toEqual(issues);

    const refreshed = AiTroubleshootingStateReducer(failed, ChatAIActions.setAI(aiConfig));
    expect(refreshed.issues).toEqual(issues);
    expect(refreshed.enabled).toBe(true);
  });

  it('counts open analysis modals and keeps the count when AI config is refreshed', () => {
    const opened = AiTroubleshootingStateReducer(
      INITIAL_TROUBLESHOOTING_STATE,
      ChatAIActions.setTroubleshootingAnalysisOpen(true)
    );
    expect(opened.openAnalyses).toBe(1);

    const second = AiTroubleshootingStateReducer(opened, ChatAIActions.setTroubleshootingAnalysisOpen(true));
    expect(second.openAnalyses).toBe(2);

    const closed = AiTroubleshootingStateReducer(second, ChatAIActions.setTroubleshootingAnalysisOpen(false));
    expect(closed.openAnalyses).toBe(1);

    const refreshed = AiTroubleshootingStateReducer(closed, ChatAIActions.setAI(aiConfig));
    expect(refreshed.openAnalyses).toBe(1);

    const none = AiTroubleshootingStateReducer(closed, ChatAIActions.setTroubleshootingAnalysisOpen(false));
    expect(none.openAnalyses).toBe(0);
    expect(AiTroubleshootingStateReducer(none, ChatAIActions.setTroubleshootingAnalysisOpen(false))).toBe(none);
  });
});
