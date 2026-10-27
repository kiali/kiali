import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import { AIUsage } from '../AIUsage';
import * as API from 'services/Api';

rstest.mock('services/Api', () => ({
  getAISessionUsage: rstest.fn(),
  getErrorString: rstest.fn(() => 'Unable to load')
}));

const renderAIUsage = (consumption = { allowed: true, enabled: true }): ReturnType<typeof render> => {
  const store = createStore(() => ({
    ai: {
      consumption,
      enabled: true
    }
  }));
  return render(
    <Provider store={store}>
      <AIUsage />
    </Provider>
  );
};

describe('AIUsage', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
  });

  it('loads session usage once on mount', async () => {
    (API.getAISessionUsage as Mock).mockResolvedValue({ data: { session: [], budget: { has_budget: false } } });

    await act(async () => {
      renderAIUsage();
    });

    expect(API.getAISessionUsage).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('No token stats yet')).toBeInTheDocument();
  });

  it('shows remaining budget bullet charts and current week threshold', async () => {
    (API.getAISessionUsage as Mock).mockResolvedValue({
      data: {
        session: [],
        budget: {
          has_budget: true,
          interval: 'weekly',
          max_cost: 10,
          max_tokens: 1,
          remaining_cost: 2.5,
          remaining_tokens: 0.25
        },
        currentPeriod: undefined,
        metrics: {
          summary: {
            byModel: [
              {
                provider: 'openai',
                model: 'gpt-4o',
                promptTokens: 0.2,
                completionTokens: 0.1,
                totalTokens: 0.3
              }
            ],
            byProvider: [
              {
                provider: 'openai',
                promptTokens: 0.2,
                completionTokens: 0.1,
                totalTokens: 0.3,
                cost: { input: 2, output: 1, total: 3 }
              }
            ]
          },
          timeSeries: {
            window: 'weekly',
            step: 'weekly',
            series: [
              {
                provider: 'openai',
                model: 'gpt-4o',
                points: [
                  {
                    timestamp: '2026-09-28T00:00:00.000Z',
                    promptTokens: 0.1,
                    completionTokens: 0.05,
                    totalTokens: 0.15,
                    cost: { input: 1, output: 0.5, total: 1.5 }
                  },
                  {
                    timestamp: '2026-10-05T00:00:00.000Z',
                    promptTokens: 0.2,
                    completionTokens: 0.1,
                    totalTokens: 0.3,
                    cost: { input: 2, output: 1, total: 3 }
                  }
                ]
              }
            ]
          },
          tokenUnit: 'millions'
        }
      }
    });

    await act(async () => {
      renderAIUsage();
    });

    expect(await screen.findByText('Budget (weekly)')).toBeInTheDocument();
    expect(await screen.findByTestId('remaining-cost-bullet')).toBeInTheDocument();
    expect(screen.getByTestId('remaining-tokens-bullet')).toBeInTheDocument();
    expect(screen.getByTestId('remaining-cost-bullet-help')).toBeInTheDocument();
    expect(screen.getByTestId('remaining-tokens-bullet-help')).toBeInTheDocument();
    expect(screen.getByTestId('remaining-cost-bullet-ratio-label')).toHaveTextContent('remaining / budget');
    expect(screen.getByTestId('remaining-tokens-bullet-ratio-label')).toHaveTextContent('remaining / budget');
    expect(screen.getByTestId('remaining-cost-bullet-percent')).toHaveTextContent('75%');
    expect(screen.getByTestId('remaining-tokens-bullet-percent')).toHaveTextContent('75%');
    fireEvent.mouseEnter(screen.getByTestId('remaining-cost-bullet-help'));
    expect(await screen.findByText('The first number is remaining budget, not usage.')).toBeInTheDocument();
    expect(screen.getByTestId('current-week-threshold-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ai-weekly-budget-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-by-provider-chart')).toBeInTheDocument();
    expect(screen.getByText('Your weekly usage')).toBeInTheDocument();
    expect(screen.getAllByText('Usage over time').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Usage versus budget').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Usage by provider').length).toBeGreaterThan(0);
    expect(screen.getByTestId('ai-usage-chart-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-tokens-cost-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-request-dd')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('current-week-threshold-chart')).queryByRole('button', { name: 'Cost' })
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('ai-user-metrics-charts')).queryByRole('button', { name: 'Cost' })
    ).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('ai-usage-tokens-cost-toggle')).getByRole('button', { name: 'Cost' }));
    expect(screen.getByTestId('ai-weekly-budget-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-line-chart')).toBeInTheDocument();
  });

  it('shows only current session stats when metrics are disabled', async () => {
    (API.getAISessionUsage as Mock).mockResolvedValue({
      data: {
        session: [
          {
            completion_tokens: 5,
            last_updated: '2026-10-07T00:00:00.000Z',
            model: 'gpt-4o',
            prompt_tokens: 10,
            provider: 'openai',
            request_count: 1,
            since: '2026-10-07T00:00:00.000Z',
            total_tokens: 15,
            user_id: 'anonymous'
          }
        ],
        budget: { has_budget: false }
      }
    });

    await act(async () => {
      renderAIUsage({ allowed: false, enabled: false });
    });

    expect(await screen.findByText('Current session')).toBeInTheDocument();
    expect(screen.queryByTestId('current-week-threshold-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-usage-budget')).not.toBeInTheDocument();
    expect(screen.queryByText('Your weekly usage')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-usage-session-grid')).toBeInTheDocument();
  });

  it('spans the request type cell across rows of the same type', async () => {
    (API.getAISessionUsage as Mock).mockResolvedValue({
      data: {
        budget: { has_budget: false },
        session: [
          {
            completion_tokens: 5,
            last_updated: '2026-10-07T00:00:00.000Z',
            model: 'gpt-4o',
            prompt_tokens: 10,
            provider: 'openai',
            request: 'chat',
            request_count: 1,
            since: '2026-10-07T00:00:00.000Z',
            total_tokens: 15,
            user_id: 'anonymous'
          },
          {
            completion_tokens: 2,
            last_updated: '2026-10-07T00:00:00.000Z',
            model: 'claude-sonnet-4-6',
            prompt_tokens: 8,
            provider: 'anthropic',
            request: 'chat',
            request_count: 1,
            since: '2026-10-07T00:00:00.000Z',
            total_tokens: 10,
            user_id: 'anonymous'
          },
          {
            completion_tokens: 4,
            last_updated: '2026-10-07T00:00:00.000Z',
            model: 'gpt-4o',
            prompt_tokens: 6,
            provider: 'openai',
            request: 'troubleshooting',
            request_count: 1,
            since: '2026-10-07T00:00:00.000Z',
            total_tokens: 10,
            user_id: 'anonymous'
          }
        ]
      }
    });

    await act(async () => {
      renderAIUsage({ allowed: false, enabled: false });
    });

    expect(await screen.findByText('Usage by Provider and Model')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Request type' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Chat' })).toHaveAttribute('rowspan', '2');
    expect(screen.getByRole('cell', { name: 'Troubleshooting' })).toHaveAttribute('rowspan', '1');
    expect(screen.getAllByRole('cell', { name: 'Chat' })).toHaveLength(1);
  });
});
