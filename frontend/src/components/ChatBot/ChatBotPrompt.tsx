import React, { useState } from 'react';
import { Map as ImmutableMap } from 'immutable';
import { ChatbotFooter, ChatbotFootnote, ChatbotFootnoteProps, MessageBar } from '@patternfly/chatbot';
import { FOOTNOTE_LABEL } from 'config/Constants';
import { Switch } from '@patternfly/react-core';
import { CHATBOT_CONVERSATION_ALWAYS_NAVIGATE, ChatEntry, ChatRequest, ContextRequest } from 'types/Chatbot';
import { KialiAppState } from 'store/Store';
import { useDispatch, useSelector } from 'react-redux';
import {
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  chatSetConversationID,
  chatSetQuery
} from 'actions/ChatAIActions';
import { throttle, uniqueId } from 'lodash-es';
import * as API from '../../services/Api';
import { t } from 'utils/I18nUtils';
import { ToolModal } from './Tools/ToolModal';

type ChatBotPromptProps = {
  setAlertMessage: () => void;
  scrollIntoView: () => void;
  handleSend: (msg: string | number, context?: any) => void;
  provider: string;
  model: string;
};

const footnoteProps: ChatbotFootnoteProps = {
  label: FOOTNOTE_LABEL
};

const SUBMIT_BUTTON_ELEMENT_CLASS = 'pf-chatbot__button--send';

export const ChatBotPrompt: React.FC<ChatBotPromptProps> = ({
  setAlertMessage,
  handleSend,
  scrollIntoView,
  provider,
  model
}) => {
  const [alwaysNavigate, setAlwaysNavigate] = useState(false);
  const dispatch = useDispatch();

  const chatHistory = useSelector((state: KialiAppState) => state.aiChat.get('chatHistory'));
  const conversationID = useSelector((state: KialiAppState) => state.aiChat.get('conversationID'));
  const query: string = useSelector((state: KialiAppState) => state.aiChat.get('query'));
  const context: ContextRequest = useSelector((state: KialiAppState) => state.aiChat.get('context'));

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [streamController, setStreamController] = React.useState(new AbortController());
  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const onChange = React.useCallback(
    (_e, value) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(chatSetQuery({ query: value }));
    },
    [dispatch]
  );

  const onSubmit = React.useCallback(() => {
    if (isStreaming) {
      return;
    }
    if (!query || query.trim().length === 0) {
      setValidated('error');
      return;
    }
    dispatch(
      chatHistoryPush({
        entry: {
          text: query,
          who: 'user'
        }
      })
    );
    const chatEntryID = uniqueId('ChatEntry_');
    dispatch(
      chatHistoryPush({
        entry: {
          id: chatEntryID,
          isCancelled: false,
          isStreaming: true,
          isTruncated: false,
          references: [],
          text: '',
          tools: ImmutableMap(),
          who: 'ai'
        }
      })
    );
    scrollIntoView();
    const requestJSON: ChatRequest = {
      // eslint-disable-next-line camelcase
      conversation_id: conversationID,
      // eslint-disable-next-line camelcase
      media_type: 'application/json',
      query: query.toString(),
      context: context as ContextRequest
    };

    const streamResponse = async () => {
      const controller = new AbortController();
      setStreamController(controller);
      const response = await API.postChatAI(provider, model, requestJSON, controller.signal);
      if (response.status != 200) {
        dispatch(
          chatHistoryUpdateByID({
            id: chatEntryID,
            entry: {
              error: {
                message: response.statusText,
                response: response
              },
              isStreaming: false,
              who: 'ai'
            }
          })
        );
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      // Throttle response text updates to prevent excessive re-renders during streaming
      const dispatchTokens = throttle(
        () => dispatch(chatHistoryUpdateByID({ id: chatEntryID, entry: { text: responseText } as Partial<ChatEntry> })),
        100,
        { leading: false, trailing: true }
      );

      let buffer = '';
      while (true) {
        const { value, done } = await reader?.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last line in the buffer. If the chunk ended mid-line, this holds the incomplete
        // line until more data arrives. If the chunk ended with '\n', split() produces an empty
        // string as the last element, so we just hold an empty buffer and process all lines.
        buffer = lines.pop() ?? '';

        lines
          .filter(s => s.startsWith('data: '))
          .forEach(s => {
            const line = s.slice(5).trim();
            let json;
            try {
              json = JSON.parse(line);
            } catch (parseError) {
              // eslint-disable-next-line no-console
              console.error(`Failed to parse JSON string "${line}"`, parseError);
            }
            if (json && json.event && json.data) {
              if (json.event === 'start') {
                console.log('start event');
                dispatch(chatSetConversationID(json.data.conversation_id));
              } else if (json.event === 'token') {
                console.log('token event');
                responseText += json.data.token;
                dispatchTokens();
              } else if (json.event === 'end') {
                dispatchTokens.flush();
                dispatch(
                  chatHistoryUpdateByID({
                    id: chatEntryID,
                    entry: {
                      isStreaming: false,
                      isTruncated: json.data.truncated === true,
                      references: json.data.referenced_documents,
                      actions: json.data.actions
                    } as Partial<ChatEntry>
                  })
                );
              } else if (json.event === 'tool_call') {
                console.log('tool_call event');
                const { args, id, name: toolName } = json.data;
                dispatch(chatHistoryUpdateTool({ id: chatEntryID, toolID: id, tool: { name: toolName, args } }));
              } else if (json.event === 'tool_result') {
                console.log('tool_result event');
                const { content, id, status } = json.data;
                dispatch(chatHistoryUpdateTool({ id: chatEntryID, toolID: id, tool: { content, status } }));
              } else if (json.event === 'error') {
                dispatchTokens.flush();
                dispatch(
                  chatHistoryUpdateByID({
                    id: chatEntryID,
                    entry: {
                      error: {
                        message: json.data.detail,
                        response: response
                      },
                      isStreaming: false
                    } as Partial<ChatEntry>
                  })
                );
              } else {
                // eslint-disable-next-line no-console
                console.warn(`Unrecognized event in response stream:`, JSON.stringify(json));
              }
            }
          });
      }
    };
    streamResponse().catch(streamError => {
      if (streamError.name !== 'AbortError') {
        dispatch(
          chatHistoryUpdateByID({
            id: chatEntryID,
            entry: {
              error: {
                message: streamError.message,
                response: streamError
              },
              isStreaming: false,
              isTruncated: false,
              who: 'ai'
            } as Partial<ChatEntry>
          })
        );
      }
      scrollIntoView();
    });

    // Clear prompt input and return focus to it
    dispatch(chatSetQuery({ query: '' }));
    textareaRef.current?.focus();
  }, [conversationID, dispatch, isStreaming, model, provider, query, scrollIntoView]);

  const handleAlwaysNavigateChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
    setAlwaysNavigate(checked);
    localStorage.setItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE, String(checked));
  };

  const streamingResponseID: string = isStreaming ? (chatHistory.last()?.get('id') as string) : undefined;

  const onStreamCancel = React.useCallback(
    e => {
      e.preventDefault();
      if (streamingResponseID) {
        streamController.abort();
        dispatch(
          chatHistoryUpdateByID({
            id: streamingResponseID,
            entry: {
              isCancelled: true,
              isStreaming: false
            } as Partial<ChatEntry>
          })
        );
      }
    },
    [dispatch, streamController, streamingResponseID]
  );

  const onKeyPress = React.useCallback(e => {
    // Enter key alone submits the prompt, Shift+Enter inserts a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (document.getElementsByClassName(SUBMIT_BUTTON_ELEMENT_CLASS)[0] as HTMLButtonElement)?.click();
    }
  }, []);

  // Prevent default keyboard submit event so we can handle it with onKeyPress
  const onKeyDown = React.useCallback(() => {}, []);

  return (
    <ChatbotFooter>
      <MessageBar
        alwayShowSendButton
        className="kiali-chatbot-plugin__prompt"
        handleStopButton={() => {
          onStreamCancel(({ preventDefault: () => {} } as unknown) as React.FormEvent);
        }}
        hasStopButton={isStreaming}
        innerRef={textareaRef}
        isSendButtonDisabled={!query || query.trim().length === 0}
        onChange={e => onChange(e, e.target.value)}
        onKeyDown={onKeyDown}
        onKeyPress={onKeyPress}
        onSendMessage={onSubmit}
        placeholder={t('Send a message...')}
        validated={validated}
        value={query}
      />
      <Switch
        id={CHATBOT_CONVERSATION_ALWAYS_NAVIGATE}
        label={'Allow Chatbot to navigate'}
        isChecked={alwaysNavigate}
        onChange={handleAlwaysNavigateChange}
      />
      <ToolModal />
      <ChatbotFootnote {...footnoteProps} />
    </ChatbotFooter>
  );
};
