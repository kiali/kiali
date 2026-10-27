import { fireEvent, render, screen } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { createStore, type Store } from 'redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import * as API from 'services/Api';
import { TroubleshootingAnalyze } from '../TroubleshootingAnalyze';

rstest.mock('services/Api', () => ({
  postTroubleshootingChat: rstest.fn(() => new Promise(() => undefined))
}));

const allowedStore = (): Store =>
  createStore(() => ({
    ai: {
      enabled: true,
      troubleshooting: {
        ai_support: { allowed: true, enabled: true },
        allowed: true,
        enabled: true
      }
    }
  }));

describe('TroubleshootingAnalyze', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    (API.postTroubleshootingChat as Mock).mockReset();
    (API.postTroubleshootingChat as Mock).mockImplementation(() => new Promise(() => undefined));
  });

  it('opens the modal with children before the chat and launches the prompt', () => {
    const store = allowedStore();
    const analysisOpen: boolean[] = [];
    const originalDispatch = store.dispatch;
    store.dispatch = (action => {
      if (action.type === ChatAIActions.setTroubleshootingAnalysisOpen(true).type) {
        analysisOpen.push((action as unknown as { payload: boolean }).payload);
      }
      return originalDispatch(action);
    }) as typeof store.dispatch;

    render(
      <Provider store={store}>
        <TroubleshootingAnalyze description="productpage" prompt="Why is productpage failing?" title="[SP1] errors">
          <p data-test="problem-info">Requests fail</p>
        </TroubleshootingAnalyze>
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(analysisOpen).toEqual([true]);
    expect(screen.getByRole('dialog')).toHaveTextContent('[SP1] errors');
    expect(screen.getByTestId('problem-info')).toHaveTextContent('Requests fail');

    const info = screen.getByTestId('problem-info');
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
  });

  it('keeps Analyze disabled when AI troubleshooting is not available', () => {
    const store = createStore(() => ({
      ai: {
        enabled: true,
        troubleshooting: {
          ai_support: { allowed: false, enabled: false },
          allowed: true,
          enabled: true
        }
      }
    }));

    render(
      <Provider store={store}>
        <TroubleshootingAnalyze prompt="Why is productpage failing?">
          <p>Requests fail</p>
        </TroubleshootingAnalyze>
      </Provider>
    );

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
