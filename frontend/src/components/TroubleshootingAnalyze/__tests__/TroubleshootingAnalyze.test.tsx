import { fireEvent, render, screen } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';

import type { KialiAppAction } from 'actions/KialiAppAction';
import { TroubleshootingDrawer } from 'components/TroubleshootingDrawer/TroubleshootingDrawer';
import { AiTroubleshootingStateReducer, INITIAL_TROUBLESHOOTING_STATE } from 'reducers/ChatAIState';
import * as API from 'services/Api';
import type { TroubleshootingSubProblem } from 'types/Chatbot';
import { TroubleshootingAnalyze } from '../TroubleshootingAnalyze';

rstest.mock('services/Api', () => ({
  postTroubleshootingChat: rstest.fn(() => new Promise(() => undefined))
}));

const subProblem: TroubleshootingSubProblem = {
  id: 'SP1',
  impact: 'Requests fail',
  issue: 'errors',
  target: 'productpage'
};

const analysisState = (
  allowed = true
): {
  ai: {
    enabled: boolean;
    troubleshooting: typeof INITIAL_TROUBLESHOOTING_STATE;
  };
  globalState: { kiosk: string };
} => ({
  ai: {
    enabled: true,
    troubleshooting: {
      ...INITIAL_TROUBLESHOOTING_STATE,
      ai_support: { allowed, enabled: allowed },
      allowed: true,
      enabled: true,
      issues: [
        {
          category: 'data_plane',
          id: 'dp-1',
          problem: 'productpage errors',
          subProblems: []
        }
      ]
    }
  },
  globalState: { kiosk: '' }
});

const analysisReducer =
  (allowed = true) =>
  (state = analysisState(allowed), action: KialiAppAction): ReturnType<typeof analysisState> => ({
    ...state,
    ai: {
      ...state.ai,
      troubleshooting: AiTroubleshootingStateReducer(state.ai.troubleshooting, action)
    }
  });

const renderAnalyze = (allowed = true): ReturnType<typeof render> => {
  const store = createStore(analysisReducer(allowed));
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <TroubleshootingAnalyze
          description="productpage"
          problem="[SP1] errors"
          prompt="Why is productpage failing?"
          subProblem={subProblem}
        />
        <TroubleshootingDrawer />
      </MemoryRouter>
    </Provider>
  );
};

describe('TroubleshootingAnalyze', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    (API.postTroubleshootingChat as Mock).mockReset();
    (API.postTroubleshootingChat as Mock).mockImplementation(() => new Promise(() => undefined));
  });

  it('opens the drawer with the problem before the chat and launches the prompt', () => {
    renderAnalyze();

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const header = screen.getByTestId('troubleshooting-drawer-header');
    expect(header).toHaveTextContent('Troubleshooting');
    expect(header).toHaveTextContent('(1 problem detected)');
    expect(screen.getByTestId('troubleshooting-drawer-link')).toHaveAttribute('href', '/ai?tab=troubleshooting');
    expect(screen.getByTestId('ai-troubleshooting-drawer')).toHaveTextContent('[SP1] errors');
    expect(screen.getByTestId('ai-troubleshooting-analysis-title')).toHaveTextContent('[SP1] errors');
    fireEvent.click(screen.getByRole('button', { name: /Show more/ }));
    expect(screen.getByTestId('ai-troubleshooting-analysis-summary')).toHaveTextContent('Requests fail');
    expect(screen.getByTestId('troubleshooting-history-list')).not.toBeVisible();

    const info = screen.getByTestId('ai-troubleshooting-analysis-summary');
    const separator = screen.getByTestId('ai-troubleshooting-analysis-separator');
    const thread = screen.getByTestId('ai-troubleshooting-analysis');
    expect(info.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separator.compareDocumentPosition(thread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(API.postTroubleshootingChat).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction_mode: 'troubleshoot',
        query: 'Why is productpage failing?'
      }),
      expect.any(AbortSignal)
    );

    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    expect(screen.getByTestId('troubleshooting-history-item')).toHaveTextContent('[SP1] errors');
  });

  it('keeps Analyze disabled when AI troubleshooting is not available', () => {
    renderAnalyze(false);

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(screen.queryByTestId('ai-troubleshooting-analysis')).not.toBeInTheDocument();
  });
});
