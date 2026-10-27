import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { createStore, type Store } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppAction } from 'actions/KialiAppAction';
import { triggerRefresh } from 'hooks/refresh';
import { AiTroubleshootingStateReducer, INITIAL_TROUBLESHOOTING_STATE } from 'reducers/ChatAIState';
import * as API from 'services/Api';
import type { TroubleshootingAIState } from 'store/Store';
import { readHiddenSubProblemIds } from 'utils/TroubleshootingStorage';
import { AITroubleshooting } from '../AITroubleshooting';

rstest.mock('services/Api', () => ({
  getAITroubleshooting: rstest.fn(),
  getErrorString: rstest.fn(() => 'Unable to load')
}));

const reviewsIssue = {
  category: 'data_plane',
  id: 'dp-1',
  problem: 'Reviews is unhealthy',
  subProblems: [
    {
      id: 'sub-visible',
      impact: 'Visible impact',
      issue: 'Visible subproblem',
      severity: 'warning',
      target: 'reviews-v1'
    },
    {
      id: 'sub-hidden',
      impact: 'Hidden impact',
      issue: 'Hidden subproblem',
      severity: 'critical',
      target: 'reviews-v2'
    }
  ]
};

type TestState = {
  ai: {
    chat: { allowed: boolean; enabled: boolean };
    enabled: boolean;
    troubleshooting: TroubleshootingAIState;
  };
  globalState: { kiosk: string; language: string };
  userSettings: { refreshInterval: number };
};

const testState = (hiddenSubProblemIds: string[] = []): TestState => ({
  ai: {
    chat: { allowed: false, enabled: false },
    enabled: false,
    troubleshooting: { ...INITIAL_TROUBLESHOOTING_STATE, hiddenSubProblemIds }
  },
  globalState: { kiosk: '', language: 'en' },
  userSettings: { refreshInterval: 0 }
});

const testReducer = (state: TestState = testState(), action: KialiAppAction): TestState => ({
  ...state,
  ai: {
    ...state.ai,
    troubleshooting: AiTroubleshootingStateReducer(state.ai.troubleshooting, action)
  }
});

const renderTroubleshooting = (
  hiddenSubProblemIds: string[] = []
): ReturnType<typeof render> & { store: Store<TestState, KialiAppAction> } => {
  const store = createStore(testReducer, testState(hiddenSubProblemIds));
  return {
    store,
    ...render(
      <Provider store={store}>
        <AITroubleshooting />
      </Provider>
    )
  };
};

describe('AITroubleshooting', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    sessionStorage.clear();
  });

  it('loads issues and fetches again when refresh is triggered', async () => {
    (API.getAITroubleshooting as Mock).mockResolvedValue({
      data: [{ ...reviewsIssue, subProblems: [] }]
    });

    renderTroubleshooting();

    expect(await screen.findByText(/Reviews is unhealthy/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-troubleshooting-summary').textContent).toContain(
      'Troubleshooting: 1 problem detected'
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(API.getAITroubleshooting).toHaveBeenCalledTimes(1);

    await act(async () => {
      triggerRefresh();
    });

    await waitFor(() => {
      expect(API.getAITroubleshooting).toHaveBeenCalledTimes(2);
    });
  });

  it('skips troubleshooting refresh while an analysis modal is open and refreshes when it closes', async () => {
    (API.getAITroubleshooting as Mock).mockResolvedValue({
      data: [{ ...reviewsIssue, subProblems: [] }]
    });

    const { store } = renderTroubleshooting();

    expect(await screen.findByText(/Reviews is unhealthy/)).toBeInTheDocument();
    expect(API.getAITroubleshooting).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(ChatAIActions.setTroubleshootingAnalysisOpen(true));
    });

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();

    await act(async () => {
      triggerRefresh();
    });
    expect(API.getAITroubleshooting).toHaveBeenCalledTimes(1);

    await act(async () => {
      store.dispatch(ChatAIActions.setTroubleshootingAnalysisOpen(false));
    });

    await waitFor(() => {
      expect(API.getAITroubleshooting).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  });

  it('splits a parent across the visible and hidden lists and keeps the hide after refetch', async () => {
    (API.getAITroubleshooting as Mock).mockResolvedValue({ data: [reviewsIssue] });

    renderTroubleshooting();

    expect((await screen.findByTestId('ai-troubleshooting-summary')).textContent).toContain(
      '{{count}} subproblems {"count":2}'
    );
    expect(screen.getByText(/Visible subproblem/)).toBeInTheDocument();
    expect(screen.getByText(/Hidden subproblem/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide problem' })[1]);

    expect((await screen.findByTestId('ai-troubleshooting-summary')).textContent).toContain('1 subproblem');
    expect(screen.getByRole('button', { name: /Hidden problems: 1 problem detected/ })).toBeInTheDocument();

    const collapsed = screen.getByRole('region', { hidden: true });
    expect(collapsed).toHaveAttribute('hidden');
    expect(collapsed).toHaveTextContent('Hidden subproblem');
    expect(collapsed).toHaveTextContent('Reviews is unhealthy');
    const visibleIssue = screen.getAllByTestId('ai-troubleshooting-issue').find(issue => !collapsed.contains(issue));
    expect(visibleIssue).toHaveTextContent('Visible subproblem');
    expect(visibleIssue).not.toHaveTextContent('Hidden subproblem');

    fireEvent.click(screen.getByRole('button', { name: /Hidden problems: 1 problem detected/ }));

    const expanded = screen.getByRole('region');
    expect(expanded).not.toHaveAttribute('hidden');
    expect(expanded).toHaveTextContent('Hidden subproblem');
    expect(screen.getAllByText(/Reviews is unhealthy/)).toHaveLength(2);
    await waitFor(() => {
      expect(readHiddenSubProblemIds()).toEqual(['sub-hidden']);
    });

    await act(async () => {
      triggerRefresh();
    });

    await waitFor(() => {
      expect(API.getAITroubleshooting).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: /Hidden problems: 1 problem detected/ })).toBeInTheDocument();
    expect(screen.getByText(/Visible subproblem/)).toBeInTheDocument();
  });

  it('puts a stored subproblem id into the hidden list on the next fetch', async () => {
    (API.getAITroubleshooting as Mock).mockResolvedValue({ data: [reviewsIssue] });

    renderTroubleshooting(['sub-hidden']);

    expect((await screen.findByTestId('ai-troubleshooting-summary')).textContent).toContain('1 subproblem');
    expect(screen.getByRole('button', { name: /Hidden problems: 1 problem detected/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { hidden: true })).toHaveTextContent('Hidden subproblem');
  });
});
