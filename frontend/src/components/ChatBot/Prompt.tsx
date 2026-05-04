import { ChatAIActions } from 'actions/ChatAIActions';
import React from 'react';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import * as API from '../../services/Api';
import { throttle, uniqueId } from 'lodash-es';
import { Map as ImmutableMap } from 'immutable';
import { useDispatch } from 'react-redux';
import { ChatRequest } from 'types/Chatbot';
import { getFetchErrorMessage } from './error';
import { MessageBar } from '@patternfly/chatbot';
import { ToolModal } from './EntryChat/ToolModal';
import { useLocationContext } from './hooks/useLocationContext';
import { buildPageContext } from './PageContext';
import { router } from 'app/History';

type PromptProps = {
  scrollIntoView: () => void;
};

export const Prompt = React.memo(({ scrollIntoView }: PromptProps) => {
  const dispatch = useDispatch();
  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const chatHistory = useSelector((s: KialiAppState) => s.aiChat.chatHistory);
  const query: string = useSelector((s: KialiAppState) => s.aiChat.query);
  const conversationID: string = useSelector((s: KialiAppState) => s.aiChat.conversationID);
  const selectedProvider: string = useSelector((s: KialiAppState) => s.aiChat.selectedProvider);
  const selectedModel: string = useSelector((s: KialiAppState) => s.aiChat.selectedModel);
  const alwaysNavigate = useSelector((s: KialiAppState) => s.aiChat.alwaysNavigate);

  const [streamController, setStreamController] = React.useState(new AbortController());
  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [kind, name, namespace, istio] = useLocationContext();
  const pageContext = React.useMemo(() => buildPageContext(kind, name, namespace, istio), [
    kind,
    name,
    namespace,
    istio
  ]);
  const onChange = React.useCallback(
    (_e: React.SyntheticEvent, value: string) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(ChatAIActions.setQuery(value));
    },
    [dispatch]
  );

  const onSubmit = React.useCallback(() => {
    if (!query || query.trim().length === 0) {
      setValidated('error');
      return;
    }
    dispatch(
      ChatAIActions.setChatHistoryAdd({
        entry: {
          text: query,
          who: 'user'
        }
      })
    );
    const chatEntryID = uniqueId('ChatEntry_');
    dispatch(
      ChatAIActions.setChatHistoryAdd({
        entry: {
          id: chatEntryID,
          text: '',
          who: 'ai',
          isCancelled: false,
          isStreaming: true,
          isTruncated: false,
          references: [],
          tools: ImmutableMap(),
          actions: []
        }
      })
    );
    scrollIntoView();

    const request: ChatRequest = {
      conversation_id: conversationID,
      query: pageContext ? `Context: ${pageContext}\n\n${query}` : query
    };

    const streamResponse = async (): Promise<void> => {
      const controller = new AbortController();
      setStreamController(controller);
      const response = await API.postChatAI(selectedProvider, selectedModel, request, controller.signal);
      // Problem with the Fetch
      if (response.status !== 200) {
        dispatch(
          ChatAIActions.setChatHistoryUpdateById({
            id: chatEntryID,
            entry: {
              error: getFetchErrorMessage({ response }),
              who: 'ai',
              isStreaming: false,
              isTruncated: false
            }
          })
        );
        return;
      }
      // Continue streaming the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let responseText = '';

      // Throttle response text updates to prevent excessive re-renders during streaming
      const dispatchTokens = throttle(
        (text: string) =>
          dispatch(
            ChatAIActions.setChatHistoryUpdateById({
              entry: {
                text: text
              },
              id: chatEntryID
            })
          ),
        100,
        { leading: false, trailing: true }
      );

      // Use buffer because long strings (e.g. tool call output) may be split into multiple chunks
      let buffer = '';

      // Manage Tools
      const toolKeyToID = new Map<string, string>();
      const makeToolKey = (toolName: string, args: unknown): string => `${toolName}:${JSON.stringify(args)}`;

      while (true) {
        const { value, done } = (await reader?.read()) ?? { value: null, done: true };
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep last line in buffer for next
        buffer = lines.pop() ?? '';

        for (const chunk of lines.filter(s => s.startsWith('data: '))) {
          const line = chunk.slice(5).trim();
          let json;
          try {
            json = JSON.parse(line);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to parse JSON string "${line}"`, error);
            continue;
          }
          if (json && json.event && json.data) {
            if (json.event === 'start') {
              dispatch(ChatAIActions.setConversationID({ id: json.data.conversation_id }));
            } else if (json.event === 'token') {
              responseText += json.data.token;
              dispatchTokens(responseText);
            } else if (json.event === 'end') {
              dispatchTokens(responseText);
              dispatchTokens.flush();
              dispatch(
                ChatAIActions.setChatHistoryUpdateById({
                  entry: {
                    actions: json.data.actions,
                    isStreaming: false,
                    isTruncated: json.data.truncated === true,
                    references: json.data.referenced_documents
                  },
                  id: chatEntryID
                })
              );
              if (alwaysNavigate) {
                const navigationAction = json.data.actions.find(
                  (action: { kind: string }) => action.kind === 'navigation'
                );
                if (navigationAction) {
                  router.navigate(navigationAction.payload);
                }
              }
            } else if (json.event === 'tool_call') {
              const { args, id, name: toolName } = json.data;
              toolKeyToID.set(makeToolKey(toolName, args), id);
              dispatch(
                ChatAIActions.setChatHistoryUpdateTool({
                  id: chatEntryID,
                  tool: {
                    args,
                    isRunning: true,
                    name: toolName
                  },
                  toolID: id
                })
              );
            } else if (json.event === 'tool_result') {
              const { content, id, status } = json.data;
              dispatch(
                ChatAIActions.setChatHistoryUpdateTool({
                  id: chatEntryID,
                  tool: {
                    content,
                    isRunning: false,
                    status
                  },
                  toolID: id
                })
              );
            } else if (json.event === 'error') {
              dispatchTokens(responseText);
              dispatchTokens.flush();
              dispatch(
                ChatAIActions.setChatHistoryUpdateById({
                  entry: {
                    error: getFetchErrorMessage({ json: { detail: json.data } }),
                    isStreaming: false
                  },
                  id: chatEntryID
                })
              );
            } else {
              // eslint-disable-next-line no-console
              console.warn(`Unrecognized event in response stream:`, JSON.stringify(json));
            }
          }
        }
      }
    };
    streamResponse().catch(streamError => {
      if (streamError.name !== 'AbortError') {
        dispatch(
          ChatAIActions.setChatHistoryUpdateById({
            id: chatEntryID,
            entry: {
              error: getFetchErrorMessage(streamError),
              isStreaming: false,
              isTruncated: false,
              who: 'ai'
            }
          })
        );
      }
      scrollIntoView();
    });
    // Clear prompt input and return focus to it
    dispatch(ChatAIActions.setQuery(''));
    textareaRef.current?.focus();
  }, [conversationID, dispatch, query, scrollIntoView, pageContext, selectedProvider, selectedModel, alwaysNavigate]);

  const streamingResponseID: string | undefined = isStreaming ? (chatHistory.last()?.get('id') as string) : undefined;

  const onStreamCancel = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (streamingResponseID) {
        streamController.abort();
        dispatch(
          ChatAIActions.setChatHistoryUpdateById({
            id: streamingResponseID,
            entry: {
              isCancelled: true,
              isStreaming: false
            }
          })
        );
      }
    },
    [dispatch, streamController, streamingResponseID]
  );
  return (
    <div>
      <MessageBar
        alwayShowSendButton
        data-testid="chatbot-message-bar-input"
        handleStopButton={() => onStreamCancel()}
        hasStopButton={isStreaming}
        innerRef={textareaRef}
        isSendButtonDisabled={!query || query.trim().length === 0}
        onChange={e => onChange(e, e.target.value)}
        onSendMessage={onSubmit}
        validated={validated}
        value={query}
      />
      <ToolModal />
    </div>
  );
});
