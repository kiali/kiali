import * as React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { ChatAIActions } from 'actions/ChatAIActions';
import { Prompt } from '../Prompt';
import * as API from 'services/Api';

// lodash-es is an ESM package that Jest cannot transform in the CRA test runner;
// replace with equivalent CJS stubs so the module loads correctly.
jest.mock('lodash-es', () => ({
  throttle: (fn: (...args: unknown[]) => unknown) => fn,
  uniqueId: (() => {
    let counter = 0;
    return (prefix = '') => `${prefix}${++counter}`;
  })()
}));

jest.mock('services/Api', () => ({
  postChatAI: jest.fn(),
  getChatPrompts: jest.fn()
}));

jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: () => ({ pathname: '/overview' })
}));

jest.mock('app/History', () => ({
  router: { navigate: jest.fn() }
}));

jest.mock('../hooks/useLocationContext', () => ({
  useLocationContext: () => [undefined, undefined, undefined, undefined]
}));

jest.mock('../PageContext', () => ({
  buildPageContext: () => undefined
}));

jest.mock('../EntryChat/ToolModal', () => ({
  ToolModal: () => null
}));

// Lightweight MessageBar stub: renders a send button that calls onSendMessage on click.
jest.mock('@patternfly/chatbot', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      <Prompt scrollIntoView={jest.fn()} />
    </Provider>
  );

describe('Prompt error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(ChatAIActions.setChatHistoryClear());
    (API.getChatPrompts as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('dispatches an error entry when the API returns a non-200 status', async () => {
    (API.postChatAI as jest.Mock).mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      body: null
    });

    store.dispatch(ChatAIActions.setQuery('What is the mesh status?'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    // Allow async stream handler to settle
    await act(async () => {});

    const lastEntry = store.getState().aiChat.chatHistory.last() as any;
    expect(lastEntry?.get('isStreaming')).toBe(false);
    expect(lastEntry?.get('error')).toBeDefined();
    expect(lastEntry?.get('who')).toBe('ai');
  });

  it('dispatches an error entry when the stream throws a non-AbortError', async () => {
    const networkError = new Error('Network connection lost');
    networkError.name = 'TypeError';
    (API.postChatAI as jest.Mock).mockRejectedValue(networkError);

    store.dispatch(ChatAIActions.setQuery('What is the mesh status?'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    await act(async () => {});

    const lastEntry = store.getState().aiChat.chatHistory.last() as any;
    expect(lastEntry?.get('isStreaming')).toBe(false);
    expect(lastEntry?.get('error')).toBeDefined();
    expect(lastEntry?.get('who')).toBe('ai');
  });

  it('does not dispatch an error entry when the stream is aborted by the user', async () => {
    const abortError = new Error('The user aborted a request');
    abortError.name = 'AbortError';
    (API.postChatAI as jest.Mock).mockRejectedValue(abortError);

    store.dispatch(ChatAIActions.setQuery('Cancel me'));

    const { getByTestId } = renderPrompt();

    await act(async () => {
      fireEvent.click(getByTestId('mock-send-button'));
    });

    await act(async () => {});

    // AbortError is silently ignored — the AI entry keeps its state from the cancel action,
    // and no additional error field is set by the catch handler.
    const lastEntry = store.getState().aiChat.chatHistory.last() as any;
    expect(lastEntry?.get('error')).toBeUndefined();
  });
});
