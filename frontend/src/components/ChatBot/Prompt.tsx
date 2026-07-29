import { ChatAIActions } from 'actions/ChatAIActions';
import React from 'react';
import { useSelector } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import * as API from '../../services/Api';
import { throttle, uniqueId } from 'lodash-es';
import { Map as ImmutableMap } from 'immutable';
import { useDispatch } from 'react-redux';
import type { ChatInteractionMode, ChatRequest, Prompt as ChatPrompt } from 'types/Chatbot';
import { getFetchErrorMessage } from './error';
import { MessageBar } from '@patternfly/chatbot';
import { ToolModal } from './EntryChat/ToolModal';
import { useLocationContext } from './hooks/useLocationContext';
import { router } from 'app/History';
import type { MenuToggleElement } from '@patternfly/react-core';
import {
  Button,
  ButtonVariant,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Tooltip
} from '@patternfly/react-core';
import { CommentDotsIcon, HelpIcon, WrenchIcon } from '@patternfly/react-icons';
import { t } from 'utils/I18nUtils';
import { DataPrompts } from './DataPrompts';
import { useLocation } from 'react-router';
import { namespacesToString } from 'types/Namespace';
import { activeNamespacesSelector } from 'store/Selectors';
import { derivePromptCategory } from './promptCategory';
import { useChatResourceHealth } from './hooks/useChatResourceHealth';
import { buildPageContext } from './pageContext';
import { buildPromptContext, buildPromptVariables, enrichPromptContext, substitutePrompts } from './promptContext';

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
  const interactionMode = useSelector((s: KialiAppState) => s.aiChat.interactionMode);
  const { pathname } = useLocation();
  const category = React.useMemo(() => derivePromptCategory(pathname), [pathname]);

  const [streamController, setStreamController] = React.useState(() => new AbortController());
  const [promptData, setPromptData] = React.useState<ChatPrompt[]>([]);
  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // MessageBar manages its own internal state and only uses `value` as
  // initial state, so we need to sync the textarea when Redux query
  // changes externally (e.g. welcome prompt click).
  React.useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== query) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
        ?.set;
      nativeInputValueSetter?.call(textareaRef.current, query);
      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [query]);

  React.useEffect(() => {
    let cancelled = false;
    API.getChatPrompts(category)
      .then(response => {
        if (!cancelled) {
          setPromptData(response.data.length > 0 ? response.data : DataPrompts[category] || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromptData(DataPrompts[category] || []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const activeNamespaces = useSelector(activeNamespacesSelector);
  const [kind, name, namespace, istio, clusterName] = useLocationContext();
  const promptContext = React.useMemo(
    () =>
      enrichPromptContext(
        buildPromptContext(kind, name, namespace, istio, clusterName),
        activeNamespaces.length > 0 ? namespacesToString(activeNamespaces) : ''
      ),
    [activeNamespaces, kind, name, namespace, istio, clusterName]
  );
  const resourceHealthStatus = useChatResourceHealth(promptContext);
  const promptVariables = React.useMemo(() => buildPromptVariables(promptContext, resourceHealthStatus), [
    promptContext,
    resourceHealthStatus
  ]);
  const resolvedPrompts = React.useMemo(() => substitutePrompts(promptData, promptVariables), [
    promptData,
    promptVariables
  ]);
  const pageContext = React.useMemo(
    () => buildPageContext(kind, name, namespace, istio, clusterName, resourceHealthStatus),
    [kind, name, namespace, istio, clusterName, resourceHealthStatus]
  );
  const onChange = React.useCallback(
    (_e: React.SyntheticEvent, value: string) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(ChatAIActions.setQuery(value));
    },
    [dispatch]
  );

  const onPromptSelect = React.useCallback(
    (promptQuery: string) => {
      dispatch(ChatAIActions.setQuery(promptQuery));
      textareaRef.current?.focus();
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
      interaction_mode: interactionMode,
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
              const actions = json.data.actions ?? [];
              dispatch(
                ChatAIActions.setChatHistoryUpdateById({
                  entry: {
                    actions,
                    isStreaming: false,
                    isTruncated: json.data.truncated === true,
                    references: json.data.referenced_documents
                  },
                  id: chatEntryID
                })
              );
              if (alwaysNavigate) {
                const navigationAction = actions.find((action: { kind: string }) => action.kind === 'navigation');
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
  }, [
    conversationID,
    dispatch,
    interactionMode,
    query,
    scrollIntoView,
    pageContext,
    selectedProvider,
    selectedModel,
    alwaysNavigate
  ]);

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

  const [isModeDropdownOpen, setIsModeDropdownOpen] = React.useState(false);

  const handleModeSelect = React.useCallback(
    (_event: React.MouseEvent<Element> | undefined, value: string | number | undefined) => {
      const newMode = value as ChatInteractionMode;
      if (chatHistory.size > 0 && newMode !== interactionMode) {
        console.info(`Interaction mode changed to ${newMode}. The assistant will adopt the new approach.`);
      }
      dispatch(ChatAIActions.setInteractionMode({ interactionMode: newMode }));
      setIsModeDropdownOpen(false);
    },
    [dispatch, chatHistory.size, interactionMode]
  );

  const modePlaceholder = interactionMode === 'ask' ? t('Ask a question...') : t('Describe the issue...');

  return (
    <div>
      {resolvedPrompts.length > 0 && query.trim().length === 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            paddingBottom: '0.5rem'
          }}
        >
          <Tooltip content={t('Suggested prompts for this page')}>
            <Button
              aria-label={t('Suggested prompts for this page')}
              variant={ButtonVariant.plain}
              icon={<HelpIcon />}
              style={{ flex: '0 0 auto' }}
            />
          </Tooltip>
          {resolvedPrompts.map(prompt => (
            <Button
              key={`${category}-${prompt.title}`}
              variant={ButtonVariant.secondary}
              size="sm"
              style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
              onClick={() => onPromptSelect(prompt.query)}
            >
              {prompt.title}
            </Button>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }} className="chatbot-message-bar-wrapper">
        <style>{`
          .chatbot-message-bar-wrapper .pf-chatbot__message-textarea {
            margin-bottom: 2rem !important;
          }
        `}</style>
        <div
          style={{
            position: 'absolute',
            left: '8px',
            bottom: '8px',
            zIndex: 2,
            pointerEvents: 'auto'
          }}
        >
          <Dropdown
            isOpen={isModeDropdownOpen}
            onOpenChange={setIsModeDropdownOpen}
            onSelect={handleModeSelect}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                data-testid="chatbot-interaction-mode-toggle"
                isExpanded={isModeDropdownOpen}
                onClick={() => setIsModeDropdownOpen(prev => !prev)}
                variant="plainText"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
                icon={interactionMode === 'ask' ? <CommentDotsIcon /> : <WrenchIcon />}
              >
                <span style={{ marginRight: '4px' }}>{interactionMode === 'ask' ? t('Ask') : t('Troubleshoot')}</span>
              </MenuToggle>
            )}
          >
            <DropdownList>
              <DropdownItem
                key="ask"
                value="ask"
                icon={<CommentDotsIcon aria-hidden />}
                description={t('Standard question and answer')}
                isSelected={interactionMode === 'ask'}
              >
                <span>{t('Ask')}</span>
              </DropdownItem>
              <DropdownItem
                key="troubleshoot"
                value="troubleshoot"
                icon={<WrenchIcon aria-hidden />}
                description={t('Focused troubleshooting assistance')}
                isSelected={interactionMode === 'troubleshoot'}
              >
                <span>{t('Troubleshoot')}</span>
              </DropdownItem>
            </DropdownList>
          </Dropdown>
        </div>
        <MessageBar
          alwayShowSendButton
          data-testid="chatbot-message-bar-input"
          handleStopButton={() => onStreamCancel()}
          hasAttachButton={false}
          hasStopButton={isStreaming}
          innerRef={textareaRef}
          isSendButtonDisabled={!query || query.trim().length === 0}
          onChange={e => onChange(e, e.target.value)}
          onSendMessage={onSubmit}
          placeholder={modePlaceholder}
          validated={validated}
          value={query}
        />
      </div>
      <ToolModal />
    </div>
  );
});
Prompt.displayName = 'Prompt';
