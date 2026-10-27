import { Alert, Button, Spinner, TextArea } from '@patternfly/react-core';
import * as React from 'react';
import { ChatMessageMarkdown } from 'components/ChatBot/EntryChat/ChatMessageMarkdown';
import { getFetchErrorMessage } from 'components/ChatBot/error';
import * as API from 'services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontWeight } from 'styles/PfTypography';
import type { ChatRequest } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { dispatchAIResponseReceived } from 'utils/aiEvents';

const threadStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md
});

const workingStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.sm
});

const userLabelStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const composerStyle = kialiStyle({
  alignItems: 'flex-end',
  display: 'flex',
  flex: 1,
  gap: PFSpacer.sm,
  minWidth: 0
});

const inputStyle = kialiStyle({
  flex: 1
});

type StreamEvent = {
  data?: {
    conversation_id?: string;
    message?: string;
    token?: string;
    truncated?: boolean;
  };
  event?: string;
};

type AnalysisMessage = {
  error?: string;
  id: number;
  text: string;
  truncated: boolean;
  who: 'ai' | 'user';
  working: boolean;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error !== '') {
      return body.error;
    }
  } catch {
    // The body is not JSON. Fall back to the status text.
  }
  return response.statusText || t('Error querying Kiali AI');
};

// Reads the same SSE events the chatbot consumes: start, token, tool_call, tool_result, end, and error.
const readAnswer = async (
  response: Response,
  onToken: (text: string) => void,
  onConversation: (conversationID: string) => void,
  signal: AbortSignal
): Promise<boolean> => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let answer = '';
  let buffer = '';
  let truncated = false;

  const consume = (lines: string[]): void => {
    for (const chunk of lines.filter(line => line.startsWith('data: '))) {
      let json: StreamEvent;
      try {
        json = JSON.parse(chunk.slice(5).trim()) as StreamEvent;
      } catch {
        continue;
      }
      if (!json.event) {
        continue;
      }
      if (json.event === 'start' && json.data?.conversation_id) {
        onConversation(json.data.conversation_id);
      } else if (json.event === 'token' && json.data?.token) {
        answer += json.data.token;
        onToken(answer);
      } else if (json.event === 'end') {
        truncated = json.data?.truncated === true;
      } else if (json.event === 'error') {
        throw new Error(json.data?.message || t('Error querying Kiali AI'));
      }
    }
  };

  while (!signal.aborted) {
    const { value, done } = (await reader?.read()) ?? { value: undefined, done: true };
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    consume(lines);
  }

  if (!signal.aborted && buffer.trim() !== '') {
    consume([buffer]);
  }

  return truncated;
};

const scrollableParent = (node: HTMLElement | null): HTMLElement | null => {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

type TroubleshootingAnalysisProps = {
  children?: (parts: { composer: React.ReactNode; thread: React.ReactNode }) => React.ReactNode;
  query: string;
};

export const TroubleshootingAnalysis: React.FC<TroubleshootingAnalysisProps> = ({ children, query }) => {
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<AnalysisMessage[]>([]);
  const conversationRef = React.useRef<string | undefined>(undefined);
  const endRef = React.useRef<HTMLDivElement>(null);
  const lastScrollTopRef = React.useRef(0);
  const nextIDRef = React.useRef(0);
  const queryRef = React.useRef(query);
  const requestRef = React.useRef<AbortController | undefined>(undefined);
  const stickToBottomRef = React.useRef(true);
  const threadRef = React.useRef<HTMLDivElement>(null);

  if (queryRef.current !== query) {
    queryRef.current = query;
    conversationRef.current = undefined;
    nextIDRef.current = 0;
    setMessages([]);
  }

  const scrollToEnd = React.useCallback((): void => {
    if (!stickToBottomRef.current) {
      return;
    }
    const parent = scrollableParent(endRef.current ?? threadRef.current);
    if (!parent) {
      return;
    }
    parent.scrollTop = parent.scrollHeight;
    lastScrollTopRef.current = parent.scrollTop;
  }, []);

  React.useLayoutEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  React.useEffect(() => {
    const threadNode = threadRef.current;
    const parent = scrollableParent(threadNode);
    if (!threadNode) {
      return;
    }
    if (parent) {
      lastScrollTopRef.current = parent.scrollTop;
    }
    // Scrolling up to read the problem or an earlier part of the answer pauses
    // following. Returning to the bottom, or sending a reply, follows again.
    const onScroll = (): void => {
      if (!parent) {
        return;
      }
      const top = parent.scrollTop;
      const distanceFromBottom = parent.scrollHeight - top - parent.clientHeight;
      if (top + 8 < lastScrollTopRef.current && distanceFromBottom > 48) {
        stickToBottomRef.current = false;
      } else if (distanceFromBottom <= 48) {
        stickToBottomRef.current = true;
      }
      lastScrollTopRef.current = top;
    };
    parent?.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            scrollToEnd();
          });
    observer?.observe(threadNode);
    return () => {
      parent?.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [scrollToEnd]);

  const patchMessage = React.useCallback((id: number, patch: Partial<AnalysisMessage>): void => {
    setMessages(current => current.map(message => (message.id === id ? { ...message, ...patch } : message)));
  }, []);

  const rememberConversation = React.useCallback((id: string): void => {
    conversationRef.current = id;
  }, []);

  const streamReply = React.useCallback(
    async (text: string, signal: AbortSignal, isCancelled: () => boolean): Promise<void> => {
      const id = nextIDRef.current;
      nextIDRef.current += 1;
      setMessages(current => [...current, { id, text: '', truncated: false, who: 'ai', working: true }]);

      const request: ChatRequest = { interaction_mode: 'troubleshoot', query: text };
      if (conversationRef.current) {
        request.conversation_id = conversationRef.current;
      }
      const response = await API.postTroubleshootingChat(request, signal);
      if (isCancelled()) {
        return;
      }
      if (response.status !== 200) {
        patchMessage(id, { error: await readErrorMessage(response), working: false });
        return;
      }
      const truncated = await readAnswer(
        response,
        answer => {
          if (!isCancelled()) {
            patchMessage(id, { text: answer });
          }
        },
        conversation => {
          if (!isCancelled()) {
            rememberConversation(conversation);
          }
        },
        signal
      );
      if (!isCancelled() && !signal.aborted) {
        patchMessage(id, { truncated, working: false });
        dispatchAIResponseReceived();
      }
    },
    [patchMessage, rememberConversation]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    let cancelled = false;

    streamReply(query, controller.signal, () => cancelled).catch(streamError => {
      if (cancelled || streamError?.name === 'AbortError') {
        return;
      }
      const id = nextIDRef.current - 1;
      patchMessage(id, {
        error: streamError instanceof Error ? streamError.message : getFetchErrorMessage(streamError).message,
        working: false
      });
      // Tokens are stored before the stream reports an error, so refresh the session view.
      dispatchAIResponseReceived();
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [patchMessage, query, streamReply]);

  // Follow-up replies replace the controller. Unmount, including modal close and
  // Cancel, must abort whichever request is still streaming.
  React.useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  const working = messages.some(message => message.working);
  const canReply = !working && draft.trim() !== '';

  const sendReply = (): void => {
    const text = draft.trim();
    if (working || text === '') {
      return;
    }
    const id = nextIDRef.current;
    nextIDRef.current += 1;
    stickToBottomRef.current = true;
    setMessages(current => [...current, { id, text, truncated: false, who: 'user', working: false }]);
    setDraft('');
    const controller = new AbortController();
    requestRef.current = controller;
    streamReply(text, controller.signal, () => controller.signal.aborted).catch(streamError => {
      if (streamError?.name === 'AbortError') {
        return;
      }
      const aiID = nextIDRef.current - 1;
      patchMessage(aiID, {
        error: streamError instanceof Error ? streamError.message : getFetchErrorMessage(streamError).message,
        working: false
      });
      dispatchAIResponseReceived();
    });
  };

  const thread = (
    <div data-test="ai-troubleshooting-analysis" ref={threadRef}>
      <div className={threadStyle}>
        {messages.map(message =>
          message.who === 'user' ? (
            <div data-test="ai-troubleshooting-analysis-user" key={message.id}>
              <div className={userLabelStyle}>{t('You')}</div>
              <div>{message.text}</div>
            </div>
          ) : (
            <div key={message.id}>
              {message.working && !message.text && !message.error && (
                <div className={workingStyle} data-test="ai-troubleshooting-analysis-status">
                  <Spinner size="md" />
                  <span>{t('Kiali AI troubleshooting working...')}</span>
                </div>
              )}
              {message.text && (
                <div data-test="ai-troubleshooting-analysis-answer">
                  <ChatMessageMarkdown content={message.text} codeBlockProps={{}} openLinkInNewTab />
                </div>
              )}
              {message.error && (
                <Alert isInline title={t('Error querying Kiali AI')} variant="danger">
                  {message.error}
                </Alert>
              )}
              {message.truncated && (
                <Alert
                  isInline
                  isPlain
                  title={
                    message.text
                      ? t('Response truncated due to output length limit.')
                      : t('Response could not be generated within the output length limit.')
                  }
                  variant="warning"
                />
              )}
              {!message.working && !message.text && !message.error && <span>{t('No analysis was returned.')}</span>}
            </div>
          )
        )}
      </div>
      <div data-test="ai-troubleshooting-analysis-end" ref={endRef} />
    </div>
  );

  const composer = (
    <div className={composerStyle}>
      <TextArea
        aria-label={t('Reply to Kiali AI troubleshooting...')}
        className={inputStyle}
        data-test="ai-troubleshooting-analysis-input"
        onChange={(_event, value) => setDraft(value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendReply();
          }
        }}
        placeholder={t('Reply to Kiali AI troubleshooting...')}
        resizeOrientation="vertical"
        rows={2}
        value={draft}
      />
      <Button data-test="ai-troubleshooting-analysis-send" isDisabled={!canReply} onClick={sendReply} variant="primary">
        {t('Send')}
      </Button>
    </div>
  );

  if (children) {
    return <>{children({ composer, thread })}</>;
  }

  return (
    <>
      {thread}
      {composer}
    </>
  );
};
