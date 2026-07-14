import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import type { Map as ImmutableMap } from 'immutable';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { ChatAIActions } from 'actions/ChatAIActions';
import { Prompt } from '../Prompt';
import * as API from 'services/Api';

// lodash-es stubs: replace with equivalent inline implementations so the module loads correctly.
rstest.mock('lodash-es', () => ({
  throttle: (fn: (...args: unknown[]) => unknown) => fn,
  uniqueId: (() => {
    let counter = 0;
    return (prefix = '') => `${prefix}${++counter}`;
  })()
}));

rstest.mock('services/Api', () => ({
  postChatAI: rstest.fn(),
  getChatPrompts: rstest.fn()
}));

rstest.mock('react-router-dom-v5-compat', () => ({
  useLocation: () => ({ pathname: '/overview' })
}));

rstest.mock('app/History', () => ({
  router: { navigate: rstest.fn() }
}));

rstest.mock('../hooks/useLocationContext', () => ({
  useLocationContext: () => [undefined, undefined, undefined, undefined]
}));

rstest.mock('../hooks/useResourceHealth', () => ({
  useResourceHealth: () => undefined
}));

rstest.mock('../EntryChat/ToolModal', () => ({
  ToolModal: () => null
}));

// Lightweight MessageBar stub: renders a send button that calls onSendMessage on click.
rstest.mock('@patternfly/chatbot', () => {
  const ReactModule = require('react');
  return {
    ChatbotDisplayMode: { default: 'default', docked: 'docked', embedded: 'embedded', fullscreen: 'fullscreen' },
    MessageBar: ({
      isSendButtonDisabled,
      onSendMessage
    }: {
      isSendButtonDisabled?: boolean;
      onSendMessage?: () => void;
    }) =>
      ReactModule.createElement(
        'button',
        {
          'data-test': 'mock-send-button',
          disabled: isSendButtonDisabled,
          onClick: onSendMessage
        },
        'Send'
      )
  };
});

const renderPrompt = (): ReturnType<typeof render> =>
  render(
    <Provider store={store}>
      <Prompt scrollIntoView={rstest.fn()} />
    </Provider>
  );

describe('Prompt error handling', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    store.dispatch(ChatAIActions.setChatHistoryClear());
    (API.getChatPrompts as Mock).mockResolvedValue({ data: [] });
  });

  it('dispatches an error entry when the API returns a non-200 status', async () => {
    (API.postChatAI as Mock).mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      body: null
    });

    store.dispatch(ChatAIActions.setQuery('What is the mesh status?'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    await waitFor(() => {
      const lastEntry = store.getState().aiChat.chatHistory.last() as ImmutableMap<string, unknown> | undefined;
      expect(lastEntry?.get('isStreaming')).toBe(false);
      const error = lastEntry?.get('error') as { message: string } | undefined;
      expect(error).toBeDefined();
      expect(error?.message).toContain('Internal Server Error');
      expect(lastEntry?.get('who')).toBe('ai');
    });
  });

  it('dispatches an error entry when the stream throws a non-AbortError', async () => {
    const networkError = new Error('Network connection lost');
    networkError.name = 'TypeError';
    (API.postChatAI as Mock).mockRejectedValue(networkError);

    store.dispatch(ChatAIActions.setQuery('What is the mesh status?'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    await waitFor(() => {
      const lastEntry = store.getState().aiChat.chatHistory.last() as ImmutableMap<string, unknown> | undefined;
      expect(lastEntry?.get('isStreaming')).toBe(false);
      expect(lastEntry?.get('error')).toBeDefined();
      expect(lastEntry?.get('who')).toBe('ai');
    });
  });

  it('does not dispatch an error entry when the stream is aborted by the user', async () => {
    const abortError = new Error('The user aborted a request');
    abortError.name = 'AbortError';
    (API.postChatAI as Mock).mockRejectedValue(abortError);

    store.dispatch(ChatAIActions.setQuery('Cancel me'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    // AbortError is silently ignored — the AI entry keeps its state from the cancel action,
    // and no additional error field is set by the catch handler.
    await waitFor(() => {
      const lastEntry = store.getState().aiChat.chatHistory.last() as ImmutableMap<string, unknown> | undefined;
      expect(lastEntry?.get('error')).toBeUndefined();
    });
  });
});
