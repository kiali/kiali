import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { ChatAIActions } from 'actions/ChatAIActions';
import { EntryChat } from '../EntryChat';

// Mock the heavy PF chatbot Message component so tests focus on EntryChat logic.
// Spread the real module first (needed for ChatbotDisplayMode used by ChatAIState reducer),
// then override only Message with a lightweight test stub that exposes the observable DOM.
jest.mock('@patternfly/chatbot', () => {
  const actual = jest.requireActual('@patternfly/chatbot');
  return {
    ...actual,
    Message: ({
      name,
      content,
      isLoading,
      extraContent,
      'data-test': dataTest
    }: {
      content?: string;
      'data-test'?: string;
      extraContent?: { afterMainContent?: React.ReactNode; beforeMainContent?: React.ReactNode };
      isLoading?: boolean;
      name?: string;
    }) => (
      <article data-test={dataTest}>
        {name && <span className="message-name">{name}</span>}
        {content && <span className="message-content">{content}</span>}
        {extraContent?.beforeMainContent}
        {extraContent?.afterMainContent}
        {isLoading && <span aria-label="loading" role="progressbar" />}
      </article>
    )
  };
});

const renderEntryChat = (entryIndex: number): ReturnType<typeof render> =>
  render(
    <Provider store={store}>
      <EntryChat entryIndex={entryIndex} />
    </Provider>
  );

describe('EntryChat', () => {
  beforeEach(() => {
    store.dispatch(ChatAIActions.setChatHistoryClear());
  });

  // ── User messages ────────────────────────────────────────────────────────────

  describe('user messages', () => {
    it('renders the user text', () => {
      store.dispatch(ChatAIActions.setChatHistoryAdd({ entry: { who: 'user', text: 'What is Kiali?' } }));
      renderEntryChat(0);
      expect(screen.getByText('What is Kiali?')).toBeInTheDocument();
    });

    it('attaches the user data-test attribute to the message root', () => {
      store.dispatch(ChatAIActions.setChatHistoryAdd({ entry: { who: 'user', text: 'Hello' } }));
      renderEntryChat(0);
      expect(screen.getByTestId('kiali__chat-entry-user')).toBeInTheDocument();
    });

    it('renders nothing for a hidden user message', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({ entry: { who: 'user', text: 'context payload', hidden: true } })
      );
      const { container } = renderEntryChat(0);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('context payload')).not.toBeInTheDocument();
    });
  });

  // ── AI messages ──────────────────────────────────────────────────────────────

  describe('AI messages', () => {
    it('renders the AI message text', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-1',
            who: 'ai',
            text: 'Kiali is a service mesh UI.',
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.getByText('Kiali is a service mesh UI.')).toBeInTheDocument();
    });

    it('attaches the AI data-test attribute to the message root', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: { id: 'ai-dt', who: 'ai', text: 'Hi', isStreaming: false, isCancelled: false, isTruncated: false }
        })
      );
      renderEntryChat(0);
      expect(screen.getByTestId('kiali__chat-entry-ai')).toBeInTheDocument();
    });

    it('renders a loading spinner while the message is streaming', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-stream',
            who: 'ai',
            text: 'Thinking...',
            isStreaming: true,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.getByRole('progressbar', { name: /loading/i })).toBeInTheDocument();
    });

    it('does not show a loading spinner once streaming has finished', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: { id: 'ai-done', who: 'ai', text: 'Done.', isStreaming: false, isCancelled: false, isTruncated: false }
        })
      );
      renderEntryChat(0);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('does not show a loading spinner when cancelled even if isStreaming is true', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-cancel-stream',
            who: 'ai',
            text: '',
            isStreaming: true,
            isCancelled: true,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // ── Error states ─────────────────────────────────────────────────────────────

  describe('error state', () => {
    it('renders a danger alert when the AI message has an error', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-err',
            who: 'ai',
            text: '',
            // When moreInfo is absent/empty, the title becomes the generic fallback
            // and the message is rendered as the alert body.
            error: { message: 'Service unavailable', moreInfo: '' },
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      // PF v6 Alert renders its title in an h4 (not via role="alert").
      // The fallback title text is used because moreInfo is empty.
      expect(screen.getByRole('heading', { name: /Error querying Kiali AI/i })).toBeInTheDocument();
      // The error message text is shown as the alert body (not expandable).
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });

    it('shows the error message in the expandable alert title when moreInfo is present', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-err-info',
            who: 'ai',
            text: '',
            // When moreInfo is present, entry.error.message becomes the title and
            // moreInfo becomes the collapsible body (collapsed by default).
            error: { message: 'Connection error', moreInfo: 'Timeout after 30 s' },
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      // The error message is the alert title (always visible).
      expect(screen.getByRole('heading', { name: /Connection error/i })).toBeInTheDocument();
      // PF v6 expandable Alert toggle button has aria-label like "Danger alert details".
      // Click it to reveal the moreInfo body.
      fireEvent.click(screen.getByRole('button', { name: /alert details/i }));
      expect(screen.getByText('Timeout after 30 s')).toBeInTheDocument();
    });
  });

  // ── Cancelled state ───────────────────────────────────────────────────────────

  describe('cancelled state', () => {
    it('renders an info alert when the message is cancelled', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-cancelled',
            who: 'ai',
            text: '',
            isCancelled: true,
            isStreaming: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  // ── Sources / references ─────────────────────────────────────────────────────

  describe('referenced documentation sources', () => {
    it('renders without errors when the AI message has valid referenced docs', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-refs',
            who: 'ai',
            text: 'See the docs.',
            references: [{ doc_title: 'Kiali Guide', doc_url: 'https://kiali.io/docs/guide' }],
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.getByText('See the docs.')).toBeInTheDocument();
    });

    it('ignores references that lack a valid http URL', () => {
      store.dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: 'ai-bad-ref',
            who: 'ai',
            text: 'No valid refs.',
            references: [{ doc_title: 'Bad ref', doc_url: 'not-a-url' }],
            isStreaming: false,
            isCancelled: false,
            isTruncated: false
          }
        })
      );
      renderEntryChat(0);
      expect(screen.getByText('No valid refs.')).toBeInTheDocument();
    });
  });
});
