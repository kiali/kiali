import { fireEvent, render, screen, within } from '@testing-library/react';
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
  hiddenIds: string[] = [],
  chatEnabled = true
): ReturnType<typeof render> & { dispatched: string[] } => {
  const dispatched: string[] = [];
  const store = createStore(
    (
      state = {
        ai: {
          chat: { allowed: chatAllowed, enabled: chatEnabled },
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

const openAiActionsMenu = (): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: 'AI actions' }));
  return screen.getByRole('menu');
};

describe('TroubleshootingSubProblemCard', () => {
  it('sends the suggested prompt in ask mode when chat is allowed', () => {
    const { dispatched } = renderAnalysis(subProblem);

    expect(screen.getByText('Requests fail')).toBeInTheDocument();
    expect(screen.queryByText('Why is productpage failing?')).not.toBeInTheDocument();

    const menu = openAiActionsMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ask AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'Why is productpage failing?' })
    );
  });

  it('keeps AI actions disabled when chat is not allowed', () => {
    const { dispatched } = renderCard(false);

    expect(screen.getByRole('button', { name: 'AI actions' })).toBeDisabled();
    expect(dispatched).not.toContain(ChatAIActions.setPendingPrompt('unused').type);
  });

  it('keeps AI actions disabled in kiosk mode', () => {
    renderCard(true, 'true');

    expect(screen.getByRole('button', { name: 'AI actions' })).toBeDisabled();
  });

  it('lists validation checks without inline Ask AI and asks from the AI actions menu', () => {
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
      istioObject: {
        group: 'networking.istio.io',
        kind: 'VirtualService',
        name: 'reviews',
        namespace: 'bookinfo',
        version: 'v1'
      },
      suggestedPrompt: undefined
    };
    const { dispatched } = renderAnalysis(checks);

    expect(screen.getAllByText('[KIA1107]')).toHaveLength(2);
    expect(screen.getByText(/spec\/http\[0\]\/route\[1\]\/destination/)).toBeInTheDocument();
    expect(screen.getByText(/spec\/http\[0\]\/route\[2\]\/destination/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View IstioObject' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ask AI about/)).not.toBeInTheDocument();

    const menu = openAiActionsMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Ask AI' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Fix it with AI' })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ask AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({ interactionMode: 'ask', text: 'Why is route 1 missing a subset?' })
    );
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

    const link = screen.getByRole('link', { name: 'View IstioObject' });
    expect(link).toHaveAttribute('href', '/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/reviews');
    expect(screen.getByTestId('ai-troubleshooting-subproblem').textContent).toMatch(
      /productpage errors\s*-\s*View IstioObject/
    );
  });

  it('places the View Workload link after the issue summary in the title', () => {
    renderAnalysis({
      ...subProblem,
      impact:
        'Workload (ReplicaSet) "kiali-traffic-generator" in namespace "bookinfo" is running without an Istio sidecar.',
      issue: 'missing Istio sidecar in injection-enabled namespace',
      suggestedPrompt: undefined,
      target: 'Workload (ReplicaSet): bookinfo/kiali-traffic-generator'
    });

    const link = screen.getByRole('link', { name: 'View Workload' });
    expect(link).toHaveAttribute('href', '/namespaces/bookinfo/workloads/kiali-traffic-generator');
    expect(screen.getByTestId('ai-troubleshooting-subproblem').textContent).toMatch(
      /missing Istio sidecar in injection-enabled namespace\s*-\s*View Workload/
    );
  });

  it('links a service subproblem to its service details page after the issue summary', () => {
    renderAnalysis({
      ...subProblem,
      suggestedPrompt: undefined,
      target: 'Service: bookinfo/productpage'
    });

    const link = screen.getByRole('link', { name: 'View Service' });
    expect(link).toHaveAttribute('href', '/namespaces/bookinfo/services/productpage');
    expect(screen.getByTestId('ai-troubleshooting-subproblem').textContent).toMatch(
      /productpage errors\s*-\s*View Service/
    );
  });

  it('links an application subproblem to its application details page', () => {
    renderAnalysis({
      ...subProblem,
      suggestedPrompt: undefined,
      target: 'Application: bookinfo/reviews'
    });

    expect(screen.getByRole('link', { name: 'View Application' })).toHaveAttribute(
      'href',
      '/namespaces/bookinfo/applications/reviews'
    );
  });

  it('links an observability stack subproblem to the Mesh page with Kiali shown', () => {
    renderAnalysis({
      ...subProblem,
      suggestedPrompt: undefined,
      target: 'Prometheus'
    });

    expect(screen.getByRole('link', { name: 'View Mesh' })).toHaveAttribute('href', '/mesh?meshKiali=true');
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
    expect(screen.queryByLabelText('Advice')).not.toBeInTheDocument();

    const menu = openAiActionsMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Fix it with AI' }));

    expect(dispatched).toContainEqual(
      ChatAIActions.setPendingPrompt({
        interactionMode: 'troubleshoot',
        intro:
          'We are going to try to fix {{problem}}: {{description}}. {"description":"productpage","problem":"[SP1] productpage errors"}',
        text: expect.stringContaining('Why is productpage failing?')
      })
    );
  });

  it('keeps AI actions disabled when chat is enabled but not allowed', () => {
    const dispatched: KialiAppAction[] = [];
    const store = createStore(() => ({
      ai: {
        chat: { allowed: false, enabled: true },
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

    const toggle = screen.getByRole('button', { name: 'AI actions' });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(dispatched).not.toContainEqual(expect.objectContaining({ type: ChatAIActions.setPendingPrompt('').type }));
  });

  it('hides AI actions when chat is not enabled', () => {
    renderCard(false, '', [], false);

    expect(screen.queryByRole('button', { name: 'AI actions' })).not.toBeInTheDocument();
  });

  it('hides AI actions when AI is not enabled', () => {
    const store = createStore(() => ({
      ai: {
        chat: { allowed: true, enabled: true },
        enabled: false,
        troubleshooting: { ...INITIAL_TROUBLESHOOTING_STATE, hiddenSubProblemIds: [] as string[] }
      },
      globalState: { kiosk: '' }
    }));

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

    expect(screen.queryByRole('button', { name: 'AI actions' })).not.toBeInTheDocument();
  });

  it('shows AI actions from suggestedPrompt when Analyze actions were cleared', () => {
    const store = createStore(() => ({
      ai: {
        chat: { allowed: false, enabled: true },
        enabled: true,
        troubleshooting: { ...INITIAL_TROUBLESHOOTING_STATE, hiddenSubProblemIds: [] as string[] }
      },
      globalState: { kiosk: '' }
    }));

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TroubleshootingSubProblemCard
            subProblem={{
              ...subProblem,
              suggestedActions: [],
              suggestedPrompt: 'Why is productpage failing?'
            }}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByRole('button', { name: 'AI actions' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide problem' })).toBeInTheDocument();
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

    const menu = openAiActionsMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Fix it with AI' }));

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
