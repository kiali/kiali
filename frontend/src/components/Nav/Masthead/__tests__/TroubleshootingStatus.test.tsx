import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import { INITIAL_TROUBLESHOOTING_STATE } from 'reducers/ChatAIState';
import type { TroubleshootingAIState } from 'store/Store';
import { TroubleshootingStatus } from '../TroubleshootingStatus';

const issue = {
  category: 'data_plane',
  id: 'dp-1',
  problem: 'Reviews is unhealthy',
  subProblems: []
};

const renderStatus = (troubleshooting: TroubleshootingAIState): ReturnType<typeof render> => {
  const store = createStore(() => ({
    ai: { troubleshooting },
    globalState: { kiosk: '' }
  }));
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <TroubleshootingStatus />
      </MemoryRouter>
    </Provider>
  );
};

describe('TroubleshootingStatus', () => {
  it('shows a danger label and tooltip when a subproblem is critical', async () => {
    const user = userEvent.setup();
    renderStatus({
      ...INITIAL_TROUBLESHOOTING_STATE,
      allowed: true,
      enabled: true,
      issues: [
        {
          ...issue,
          subProblems: [
            { id: 'sub-1', impact: 'Down', issue: 'Crash', severity: 'critical', target: 'reviews' },
            { id: 'sub-2', impact: 'Slow', issue: 'Latency', severity: 'warning', target: 'ratings' }
          ]
        }
      ],
      loaded: true
    });

    const label = screen.getByTestId('troubleshooting-status-danger');
    expect(label).toHaveClass('pf-m-attention');
    expect(label).toHaveTextContent('1');

    await user.hover(label);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('critical');
    expect(tooltip.textContent).toContain('warning');
    expect(tooltip.textContent).toContain('Reviews is unhealthy');
    expect(screen.getByTestId('troubleshooting-status-link')).toHaveAttribute('href', '/ai?tab=troubleshooting');
  });

  it('hides the tooltip while the drawer is open', async () => {
    const user = userEvent.setup();
    renderStatus({
      ...INITIAL_TROUBLESHOOTING_STATE,
      allowed: true,
      drawerExpanded: true,
      enabled: true,
      issues: [issue],
      loaded: true
    });

    await user.hover(screen.getByTestId('troubleshooting-status-warning'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses the warning label when no subproblem is critical', () => {
    renderStatus({
      ...INITIAL_TROUBLESHOOTING_STATE,
      allowed: true,
      enabled: true,
      issues: [issue, { ...issue, id: 'dp-2', problem: 'Ratings is unhealthy' }],
      loaded: true
    });

    const label = screen.getByTestId('troubleshooting-status-warning');
    expect(label).toHaveClass('pf-m-unread');
    expect(label).toHaveTextContent('2');
    expect(screen.queryByTestId('troubleshooting-status-danger')).not.toBeInTheDocument();
  });

  it('toggles the troubleshooting drawer from the badge', async () => {
    const user = userEvent.setup();
    const dispatched: string[] = [];
    const store = createStore(() => ({
      ai: {
        troubleshooting: {
          ...INITIAL_TROUBLESHOOTING_STATE,
          allowed: true,
          enabled: true,
          issues: [issue],
          loaded: true
        }
      },
      globalState: { kiosk: '' }
    }));
    const originalDispatch = store.dispatch;
    store.dispatch = (action => {
      dispatched.push((action as { type: string }).type);
      return originalDispatch(action);
    }) as typeof store.dispatch;

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TroubleshootingStatus />
        </MemoryRouter>
      </Provider>
    );

    await user.click(screen.getByTestId('troubleshooting-status-warning'));
    expect(dispatched).toContain(ChatAIActions.toggleTroubleshootingDrawer().type);
  });

  it('stays hidden when troubleshooting is disabled, not allowed, or found nothing', () => {
    const { rerender } = renderStatus({
      ...INITIAL_TROUBLESHOOTING_STATE,
      allowed: false,
      enabled: true,
      issues: [issue],
      loaded: true
    });
    expect(screen.queryByTestId('troubleshooting-status-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('troubleshooting-status-danger')).not.toBeInTheDocument();

    rerender(
      <Provider
        store={createStore(() => ({
          ai: {
            troubleshooting: {
              ...INITIAL_TROUBLESHOOTING_STATE,
              allowed: true,
              enabled: false,
              issues: [issue],
              loaded: true
            }
          },
          globalState: { kiosk: '' }
        }))}
      >
        <MemoryRouter>
          <TroubleshootingStatus />
        </MemoryRouter>
      </Provider>
    );
    expect(screen.queryByTestId('troubleshooting-status-warning')).not.toBeInTheDocument();

    rerender(
      <Provider
        store={createStore(() => ({
          ai: {
            troubleshooting: {
              ...INITIAL_TROUBLESHOOTING_STATE,
              allowed: true,
              enabled: true,
              issues: [],
              loaded: true
            }
          },
          globalState: { kiosk: '' }
        }))}
      >
        <MemoryRouter>
          <TroubleshootingStatus />
        </MemoryRouter>
      </Provider>
    );
    expect(screen.queryByTestId('troubleshooting-status-warning')).not.toBeInTheDocument();
  });
});
