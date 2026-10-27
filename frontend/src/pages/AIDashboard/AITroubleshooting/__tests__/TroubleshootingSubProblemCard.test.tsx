import { fireEvent, render, screen } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import * as API from 'services/Api';
import { TroubleshootingSubProblemCard } from '../TroubleshootingSubProblemCard';

rstest.mock('services/Api', () => ({
  postTroubleshootingChat: rstest.fn(() => new Promise(() => undefined))
}));

const subProblem = {
  id: 'SP1',
  impact: 'Requests fail',
  issue: 'productpage errors',
  suggestedPrompt: 'Why is productpage failing?',
  target: 'productpage'
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
  it('sends the suggested prompt when chat is allowed', () => {
    const { dispatched } = renderCard(true);

    expect(screen.getByText('Requests fail')).toBeInTheDocument();
    expect(screen.queryByText('Why is productpage failing?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask chatbot' }));

    expect(dispatched).toContain(ChatAIActions.setPendingPrompt('Why is productpage failing?').type);
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
      const typed = action as { payload?: string; type: string };
      dispatched.push(typed.type);
      if (typeof typed.payload === 'string') {
        prompts.push(typed.payload);
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

  it('opens a troubleshooting analysis from the Question action', () => {
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: false, enabled: false },
            enabled: true,
            troubleshooting: {
              ai_support: { allowed: true, enabled: true },
              allowed: true,
              enabled: true,
              hiddenSubProblemIds: [] as string[]
            }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );

    render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard
          subProblem={{
            ...subProblem,
            suggestedActions: [
              { description: 'Ask the AI to analyze productpage', type: 'Question' },
              { command: 'kubectl get pods', description: 'Check pods', type: 'Advice' }
            ]
          }}
        />
      </Provider>
    );

    expect(screen.queryByRole('button', { name: 'Question' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Advice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(screen.getByTestId('ai-troubleshooting-analysis-status')).toHaveTextContent(
      'Kiali AI troubleshooting working...'
    );
    expect(API.postTroubleshootingChat).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction_mode: 'troubleshoot',
        query: expect.stringContaining('Why is productpage failing?')
      }),
      expect.any(AbortSignal)
    );
  });

  it('analyzes an istio object from the action prompt', () => {
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: false, enabled: false },
            enabled: true,
            troubleshooting: {
              ai_support: { allowed: true, enabled: true },
              allowed: true,
              enabled: true,
              hiddenSubProblemIds: [] as string[]
            }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );

    render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard
          subProblem={{
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
          }}
        />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(API.postTroubleshootingChat).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('istio/networking.istio.io/v1/VirtualService/reviews')
      }),
      expect.any(AbortSignal)
    );
  });

  it('cancels the analysis stream when the modal is closed', () => {
    let signal: AbortSignal | undefined;
    (API.postTroubleshootingChat as Mock).mockImplementation((_request: unknown, nextSignal: AbortSignal) => {
      signal = nextSignal;
      return new Promise(() => undefined);
    });
    const analysisOpen: boolean[] = [];
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: false, enabled: false },
            enabled: true,
            troubleshooting: {
              ai_support: { allowed: true, enabled: true },
              allowed: true,
              enabled: true,
              hiddenSubProblemIds: [] as string[]
            }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );
    const originalDispatch = store.dispatch;
    store.dispatch = (action => {
      if (action.type === ChatAIActions.setTroubleshootingAnalysisOpen(true).type) {
        analysisOpen.push((action as unknown as { payload: boolean }).payload);
      }
      return originalDispatch(action);
    }) as typeof store.dispatch;

    render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard
          subProblem={{
            ...subProblem,
            suggestedActions: [{ description: 'Analyze productpage', type: 'Analyze' }]
          }}
        />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(analysisOpen).toEqual([true]);
    expect(screen.getByTestId('ai-troubleshooting-analysis-summary')).toHaveTextContent('Requests fail');
    expect(screen.getByRole('dialog')).toHaveTextContent('[SP1] productpage errors');

    expect(screen.getByTestId('ai-troubleshooting-analysis-input')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(analysisOpen).toEqual([true, false]);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows validation checks in the analysis modal', () => {
    const store = createStore(
      (
        state = {
          ai: {
            chat: { allowed: false, enabled: false },
            enabled: true,
            troubleshooting: {
              ai_support: { allowed: true, enabled: true },
              allowed: true,
              enabled: true,
              hiddenSubProblemIds: [] as string[]
            }
          },
          globalState: { kiosk: '' }
        }
      ) => state
    );

    render(
      <Provider store={store}>
        <TroubleshootingSubProblemCard
          subProblem={{
            ...subProblem,
            checks: [
              {
                code: 'KIA1101',
                message: "DestinationWeight on route doesn't have a valid service (host not found)",
                path: 'spec/http[0]/route[2]/destination/host',
                severity: 'warning'
              },
              {
                code: 'KIA1107',
                message: 'Subset not found',
                path: 'spec/http[0]/route[1]/destination',
                severity: 'warning'
              }
            ],
            suggestedActions: [{ description: 'Analyze the virtual service', type: 'Analyze' }]
          }}
        />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('[KIA1101]');
    expect(dialog).toHaveTextContent(
      "DestinationWeight on route doesn't have a valid service (host not found) (spec/http[0]/route[2]/destination/host)"
    );
    expect(dialog).toHaveTextContent('[KIA1107]');
    expect(dialog).toHaveTextContent('Subset not found (spec/http[0]/route[1]/destination)');

    const checks = screen.getByTestId('ai-troubleshooting-analysis-checks');
    const separator = screen.getByTestId('ai-troubleshooting-analysis-separator');
    const thread = screen.getByTestId('ai-troubleshooting-analysis');
    expect(checks.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separator.compareDocumentPosition(thread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
