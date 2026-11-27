import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppAction } from 'actions/KialiAppAction';
import { AIChatContext } from 'hooks/aiInteraction';
import type { OpenAIChatFn } from 'hooks/aiInteraction';
import * as NavigationUtils from 'utils/NavigationUtils';
import { InteractAI } from '../InteractAI';

const renderInteractAI = (
  props: Partial<React.ComponentProps<typeof InteractAI>> = {},
  options: {
    aiEnabled?: boolean;
    chat?: { allowed: boolean; enabled: boolean };
    openAIChat?: OpenAIChatFn;
  } = {}
): { dispatched: KialiAppAction[] } => {
  const dispatched: KialiAppAction[] = [];
  const chat = options.chat ?? { allowed: true, enabled: true };
  const store = createStore(() => ({
    ai: {
      chat: { ...chat, reviewPromptBeforeSend: false },
      enabled: options.aiEnabled ?? true
    },
    globalState: { kiosk: '' }
  }));
  const originalDispatch = store.dispatch;
  store.dispatch = (action => {
    dispatched.push(action as KialiAppAction);
    return originalDispatch(action);
  }) as typeof store.dispatch;

  const tree = (
    <Provider store={store}>
      <InteractAI mode="ask" prompt="Why is productpage failing?" tooltip="Ask AI" {...props} />
    </Provider>
  );

  render(
    options.openAIChat ? <AIChatContext.Provider value={options.openAIChat}>{tree}</AIChatContext.Provider> : tree
  );

  return { dispatched };
};

describe('InteractAI', () => {
  afterEach(() => {
    rstest.restoreAllMocks();
  });

  it('asks in ask mode', () => {
    const { dispatched } = renderInteractAI({ mode: 'ask', tooltip: 'Ask AI' });

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'Why is productpage failing?' })
    );
  });

  it('troubleshoots in troubleshoot mode', () => {
    const { dispatched } = renderInteractAI({
      description: 'productpage',
      mode: 'troubleshoot',
      problem: '[SP1] productpage errors',
      tooltip: 'Fix it with AI'
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fix it with AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        intro:
          'We are going to try to fix {{problem}}: {{description}}. {"description":"productpage","problem":"[SP1] productpage errors"}',
        text: 'Why is productpage failing?'
      })
    );
  });

  it('prepends context in troubleshoot mode', () => {
    const { dispatched } = renderInteractAI({
      context: 'Context: Service productpage',
      mode: 'troubleshoot',
      tooltip: 'Fix it with AI'
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fix it with AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        text: 'Context: Service productpage\n\nWhy is productpage failing?'
      })
    );
  });

  it('sends a prompt with no mode', () => {
    const { dispatched } = renderInteractAI({ mode: '', tooltip: 'Chat with AI' });

    fireEvent.click(screen.getByRole('button', { name: 'Chat with AI' }));

    expect(dispatched).toContainEqual(ChatAIActions.setPendingPrompt('Why is productpage failing?'));
  });

  it('uses a custom icon when provided', () => {
    renderInteractAI({
      icon: <span data-test="custom-ai-icon">custom</span>,
      mode: 'troubleshoot',
      tooltip: 'Fix it with AI'
    });

    expect(screen.getByTestId('custom-ai-icon')).toBeInTheDocument();
  });

  it('sets data-test from dataTest', () => {
    renderInteractAI({ dataTest: 'my-ai-button' });

    expect(screen.getByTestId('my-ai-button')).toBeInTheDocument();
  });

  it('hides when visible is false', () => {
    renderInteractAI({ visible: false });

    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('hides when prompt is empty', () => {
    renderInteractAI({ prompt: '   ' });

    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('hides by default when chat is not enabled', () => {
    renderInteractAI({}, { chat: { allowed: true, enabled: false } });

    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('respects disabled', () => {
    const { dispatched } = renderInteractAI({ disabled: true });

    const button = screen.getByRole('button', { name: 'Ask AI' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(dispatched).toHaveLength(0);
  });

  it('disables by default when chat is not allowed', () => {
    const { dispatched } = renderInteractAI({}, { chat: { allowed: false, enabled: true } });

    const button = screen.getByRole('button', { name: 'Ask AI' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(dispatched).toHaveLength(0);
  });

  it('routes through openAIChat in OSSMC', () => {
    rstest.spyOn(NavigationUtils, 'isOSSMC').mockReturnValue(true);
    const calls: unknown[][] = [];
    const openAIChat: OpenAIChatFn = (...args) => {
      calls.push(args);
    };

    const { dispatched } = renderInteractAI(
      { mode: 'ask', tooltip: 'Ask AI' },
      { aiEnabled: false, chat: { allowed: false, enabled: false }, openAIChat }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(calls).toEqual([['Why is productpage failing?', undefined, true]]);
    expect(dispatched).toHaveLength(0);
  });
});
