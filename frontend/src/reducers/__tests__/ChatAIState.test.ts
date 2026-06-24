import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { ChatAiStateReducer, INITIAL_CHAT_AI_STATE } from '../ChatAIState';
import { ChatAIActions } from '../../actions/ChatAIActions';

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
});
