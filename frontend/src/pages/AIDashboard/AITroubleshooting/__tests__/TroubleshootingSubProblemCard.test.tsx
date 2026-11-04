import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppAction } from 'actions/KialiAppAction';
import { AiTroubleshootingStateReducer, INITIAL_TROUBLESHOOTING_STATE } from 'reducers/ChatAIState';
import type { TroubleshootingSubProblem } from 'types/Chatbot';
import { TroubleshootingSubProblemCard } from '../TroubleshootingSubProblemCard';

const subProblem = {
  id: 'SP1',
  impact: 'Requests fail',
  issue: 'productpage errors',
  suggestedPrompt: 'Why is productpage failing?',
  target: 'productpage'
};

const analysisState = (): {
  ai: {
    chat: { allowed: boolean; enabled: boolean };
    enabled: boolean;
    troubleshooting: typeof INITIAL_TROUBLESHOOTING_STATE;
  };
  globalState: { kiosk: string };
} => ({
  ai: {
    chat: { allowed: true, enabled: true },
    enabled: true,
    troubleshooting: {
      ...INITIAL_TROUBLESHOOTING_STATE,
      hiddenSubProblemIds: [] as string[]
    }
  },
  globalState: { kiosk: '' }
});

const analysisReducer = (state = analysisState(), action: KialiAppAction): ReturnType<typeof analysisState> => ({
  ...state,
  ai: {
    ...state.ai,
    troubleshooting: AiTroubleshootingStateReducer(state.ai.troubleshooting, action)
  }
});

const renderAnalysis = (
  nextSubProblem: TroubleshootingSubProblem
): ReturnType<typeof render> & { dispatched: KialiAppAction[]; store: ReturnType<typeof createStore> } => {
  const dispatched: KialiAppAction[] = [];
  const store = createStore(analysisReducer);
  const originalDispatch = store.dispatch;
  store.dispatch = (action => {
    dispatched.push(action as KialiAppAction);
    return originalDispatch(action);
  }) as typeof store.dispatch;
  return {
    dispatched,
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <TroubleshootingSubProblemCard subProblem={nextSubProblem} />
        </MemoryRouter>
      </Provider>
    )
  };
};

const renderCard = (
  chatAllowed: boolean,
  kiosk = '',
  hiddenIds: string[] = []
): ReturnType<typeof render> & { dispatched: string[] } => {
  const dispatched: string[] = [];
  const store = createStore(
    (
      state = {
        ai: {
          chat: { allowed: chatAllowed, enabled: chatAllowed },
          enabled: true,
          troubleshooting: { hiddenSubProblemIds: hiddenIds }
        },
        globalState: { kiosk }
      }
    ) => state
  );
  const originalDispatch = store.dispatch;
  store.dispatch = (action => {
    dispatched.push((action as { type: string }).type);
    return originalDispatch(action);
  }) as typeof store.dispatch;

  return {
    dispatched,
    ...render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard subProblem={subProblem} />
      </Provider>
    )
  };
};

describe('TroubleshootingSubProblemCard', () => {
  it('sends the suggested prompt in ask mode when chat is allowed', () => {
    const { dispatched } = renderAnalysis(subProblem);

    expect(screen.getByText('Requests fail')).toBeInTheDocument();
    expect(screen.queryByText('Why is productpage failing?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask chatbot' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'Why is productpage failing?' })
    );
  });

  it('keeps ask chatbot disabled when chat is not allowed', () => {
    const { dispatched } = renderCard(false);

    expect(screen.getByRole('button', { name: 'Ask chatbot' })).toBeDisabled();
    expect(dispatched).not.toContain(ChatAIActions.setPendingPrompt('unused').type);
  });

  it('keeps ask chatbot disabled in kiosk mode', () => {
    renderCard(true, 'true');

    expect(screen.getByRole('button', { name: 'Ask chatbot' })).toBeDisabled();
  });

  it('asks about each validation check on the same object', () => {
    const checks = {
      ...subProblem,
      checks: [
        {
          code: 'KIA1107',
          message: 'Subset not found',
          path: 'spec/http[0]/route[1]/destination',
          severity: 'warning',
          suggestedPrompt: 'Why is route 1 missing a subset?'
        },
        {
          code: 'KIA1107',
          message: 'Subset not found',
          path: 'spec/http[0]/route[2]/destination',
          severity: 'warning',
          suggestedPrompt: 'Why is route 2 missing a subset?'
        }
      ],
      suggestedPrompt: undefined
    };
    const dispatched: string[] = [];
    const prompts: string[] = [];
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: true, enabled: true },
            enabled: true,
            troubleshooting: { hiddenSubProblemIds: [] as string[] }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );
    const originalDispatch = store.dispatch;
    store.dispatch = (action => {
      const typed = action as { payload?: { interactionMode?: string; text?: string } | string; type: string };
      dispatched.push(typed.type);
      if (typeof typed.payload === 'string') {
        prompts.push(typed.payload);
      } else if (typed.payload?.text) {
        prompts.push(typed.payload.text);
        expect(typed.payload.interactionMode).toBe('ask');
      }
      return originalDispatch(action);
    }) as typeof store.dispatch;

    render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard subProblem={checks} />
      </Provider>
    );

    expect(screen.getAllByText('[KIA1107]')).toHaveLength(2);
    expect(screen.getByText(/spec\/http\[0\]\/route\[1\]\/destination/)).toBeInTheDocument();
    expect(screen.getByText(/spec\/http\[0\]\/route\[2\]\/destination/)).toBeInTheDocument();

    const askButtons = screen.getAllByTestId('ai-troubleshooting-ask-chatbot');
    expect(askButtons).toHaveLength(2);
    fireEvent.click(askButtons[1]);
    expect(dispatched).toContain(ChatAIActions.setPendingPrompt('Why is route 2 missing a subset?').type);
    expect(prompts).toContain('Why is route 2 missing a subset?');
  });

  it('links an istio object subproblem to its config details page', () => {
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: true, enabled: true },
            enabled: true,
            troubleshooting: { hiddenSubProblemIds: [] as string[] }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TroubleshootingSubProblemCard
            subProblem={{
              ...subProblem,
              istioObject: {
                group: 'networking.istio.io',
                kind: 'VirtualService',
                name: 'reviews',
                namespace: 'bookinfo',
                version: 'v1'
              }
            }}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByRole('link', { name: 'View IstioObject' })).toHaveAttribute(
      'href',
      '/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/reviews'
    );
  });

  it('sends a troubleshooting question to the chatbot', () => {
    const { dispatched } = renderAnalysis({
      ...subProblem,
      suggestedActions: [
        { description: 'Ask the AI to analyze productpage', type: 'Question' },
        { command: 'kubectl get pods', description: 'Check pods', type: 'Advice' }
      ]
    });

    expect(screen.queryByRole('button', { name: 'Question' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Advice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        intro:
          'We are going to try to fix {{problem}}: {{description}}. {"description":"productpage","problem":"[SP1] productpage errors"}',
        text: expect.stringContaining('Why is productpage failing?')
      })
    );
  });

  it('keeps Analyze disabled when chat is not available', () => {
    const dispatched: KialiAppAction[] = [];
    const store = createStore(() => ({
      ai: {
        chat: { allowed: false, enabled: false },
        enabled: true,
        troubleshooting: { ...INITIAL_TROUBLESHOOTING_STATE, hiddenSubProblemIds: [] as string[] }
      },
      globalState: { kiosk: '' }
    }));
    const originalDispatch = store.dispatch;
    store.dispatch = (action => {
      dispatched.push(action as KialiAppAction);
      return originalDispatch(action);
    }) as typeof store.dispatch;

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TroubleshootingSubProblemCard
            subProblem={{
              ...subProblem,
              suggestedActions: [{ description: 'Ask the AI to analyze productpage', type: 'Question' }]
            }}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(dispatched).not.toContainEqual(expect.objectContaining({ type: ChatAIActions.setPendingPrompt('').type }));
  });

  it('analyzes an istio object from the action prompt', () => {
    const { dispatched } = renderAnalysis({
      ...subProblem,
      suggestedPrompt: undefined,
      suggestedActions: [
        {
          description: 'Analyze the YAML of VirtualService reviews',
          prompt:
            'Analyze the YAML of Istio object istio/networking.istio.io/v1/VirtualService/reviews in namespace bookinfo. Fetch it with manage_istio_config_read action get, object="reviews".',
          type: 'Analyze'
        }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt(
        expect.objectContaining({
          interactionMode: 'troubleshoot',
          text: expect.stringContaining('istio/networking.istio.io/v1/VirtualService/reviews')
        })
      )
    );
  });

  it('hides a visible subproblem and shows a hidden one', () => {
    const visible = renderCard(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hide problem' }));
    expect(visible.dispatched).toContain(ChatAIActions.hideTroubleshootingSubProblem('SP1').type);

    const hidden = renderCard(true, '', ['SP1']);
    fireEvent.click(screen.getByRole('button', { name: 'Show problem' }));
    expect(hidden.dispatched).toContain(ChatAIActions.showTroubleshootingSubProblem('SP1').type);
  });
});
