import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppAction } from 'actions/KialiAppAction';
import { buildTroubleshootIntro, useAIInteraction } from '../aiInteraction';

type TestState = {
  ai: {
    chat: { allowed: boolean; enabled: boolean };
    enabled: boolean;
  };
  globalState: { kiosk: string };
};

const createTestStore = (
  overrides?: Partial<{ aiEnabled: boolean; chatAllowed: boolean; chatEnabled: boolean; kiosk: string }>
): { dispatched: KialiAppAction[]; store: ReturnType<typeof createStore> } => {
  const dispatched: KialiAppAction[] = [];
  const initialState: TestState = {
    ai: {
      chat: {
        allowed: overrides?.chatAllowed ?? true,
        enabled: overrides?.chatEnabled ?? true
      },
      enabled: overrides?.aiEnabled ?? true
    },
    globalState: {
      kiosk: overrides?.kiosk ?? ''
    }
  };
  const store = createStore((state = initialState) => state);
  const originalDispatch = store.dispatch;
  store.dispatch = (action => {
    dispatched.push(action as KialiAppAction);
    return originalDispatch(action);
  }) as typeof store.dispatch;
  return { dispatched, store };
};

const HookConsumer: React.FC = () => {
  const { askChat, canSendPrompt, chatAllowed, chatEnabled, openChat, sendPrompt, troubleshoot } = useAIInteraction();
  return (
    <div>
      <span data-test="chat-allowed">{String(chatAllowed)}</span>
      <span data-test="chat-enabled">{String(chatEnabled)}</span>
      <span data-test="can-send-valid">{String(canSendPrompt('hello'))}</span>
      <span data-test="can-send-empty">{String(canSendPrompt('   '))}</span>
      <button onClick={() => openChat()}>Open Chat</button>
      <button onClick={() => askChat('What is wrong with productpage?')}>Ask Chat</button>
      <button onClick={() => askChat('   ')}>Ask Empty</button>
      <button onClick={() => sendPrompt({ interactionMode: 'ask', text: 'Custom prompt' })}>Send Prompt</button>
      <button
        onClick={() =>
          troubleshoot({
            context: 'Context: Service productpage',
            description: 'productpage',
            problem: '[SP1] productpage errors',
            prompt: 'Why is productpage failing?'
          })
        }
      >
        Troubleshoot With Context
      </button>
      <button onClick={() => troubleshoot('Direct troubleshoot prompt')}>Troubleshoot Direct</button>
    </div>
  );
};

describe('useAIInteraction', () => {
  it('reports chatAllowed and dispatches ask, troubleshoot, sendPrompt, and openChat when allowed', () => {
    const { dispatched, store } = createTestStore();

    render(
      <Provider store={store}>
        <HookConsumer />
      </Provider>
    );

    expect(screen.getByTestId('chat-allowed')).toHaveTextContent('true');
    expect(screen.getByTestId('chat-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('can-send-valid')).toHaveTextContent('true');
    expect(screen.getByTestId('can-send-empty')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'Open Chat' }));
    expect(dispatched).toContainEqual(ChatAIActions.setChatVisible(true));

    fireEvent.click(screen.getByRole('button', { name: 'Ask Chat' }));
    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'What is wrong with productpage?' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send Prompt' }));
    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'Custom prompt' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Troubleshoot With Context' }));
    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        intro: buildTroubleshootIntro('[SP1] productpage errors', 'productpage'),
        text: 'Context: Service productpage\n\nWhy is productpage failing?'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Troubleshoot Direct' }));
    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        text: 'Direct troubleshoot prompt'
      })
    );
  });

  it('ignores empty prompts even when chat is allowed', () => {
    const { dispatched, store } = createTestStore();

    render(
      <Provider store={store}>
        <HookConsumer />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask Empty' }));
    expect(dispatched).toHaveLength(0);
  });

  it('disables chat interactions when chat is not allowed or in kiosk mode', () => {
    const disallowed = createTestStore({ chatAllowed: false });
    const { unmount } = render(
      <Provider store={disallowed.store}>
        <HookConsumer />
      </Provider>
    );

    expect(screen.getByTestId('chat-allowed')).toHaveTextContent('false');
    expect(screen.getByTestId('chat-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('can-send-valid')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Troubleshoot Direct' }));
    expect(disallowed.dispatched).toHaveLength(0);
    unmount();

    const disabled = createTestStore({ chatAllowed: false, chatEnabled: false });
    const disabledView = render(
      <Provider store={disabled.store}>
        <HookConsumer />
      </Provider>
    );
    expect(screen.getByTestId('chat-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('chat-allowed')).toHaveTextContent('false');
    disabledView.unmount();

    const kiosk = createTestStore({ kiosk: 'true' });
    render(
      <Provider store={kiosk.store}>
        <HookConsumer />
      </Provider>
    );

    expect(screen.getByTestId('chat-allowed')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ask Chat' }));
    expect(kiosk.dispatched).toHaveLength(0);
  });
});
