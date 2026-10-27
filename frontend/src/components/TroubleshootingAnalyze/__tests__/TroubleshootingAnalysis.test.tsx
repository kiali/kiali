import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Mock } from '@rstest/core';

import * as API from 'services/Api';
import { TroubleshootingAnalysis } from '../TroubleshootingAnalysis';

rstest.mock('services/Api', () => ({
  postTroubleshootingChat: rstest.fn()
}));

const sseResponse = (events: string[], status = 200): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    }
  });
  return new Response(stream, { status });
};

describe('TroubleshootingAnalysis', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    (API.postTroubleshootingChat as Mock).mockReset();
  });

  it('shows the working status and then the streamed answer', async () => {
    (API.postTroubleshootingChat as Mock).mockResolvedValue(
      sseResponse([
        JSON.stringify({ data: { token: 'The subset ' }, event: 'token' }),
        JSON.stringify({ data: { token: 'is missing.' }, event: 'token' }),
        JSON.stringify({ data: { truncated: false }, event: 'end' })
      ])
    );

    render(<TroubleshootingAnalysis query="Analyze reviews" />);

    expect(screen.getByTestId('ai-troubleshooting-analysis-status')).toHaveTextContent(
      'Kiali AI troubleshooting working...'
    );
    expect(screen.getByTestId('ai-troubleshooting-analysis-input')).toBeInTheDocument();
    expect(screen.getByTestId('ai-troubleshooting-analysis-send')).toBeDisabled();

    expect(await screen.findByTestId('ai-troubleshooting-analysis-answer')).toHaveTextContent('The subset is missing.');
    expect(screen.queryByTestId('ai-troubleshooting-analysis-status')).not.toBeInTheDocument();
    expect(API.postTroubleshootingChat).toHaveBeenCalledWith(
      { interaction_mode: 'troubleshoot', query: 'Analyze reviews' },
      expect.any(AbortSignal)
    );
  });

  it('sends a follow-up in the same conversation', async () => {
    (API.postTroubleshootingChat as Mock).mockImplementation((request: { query: string }) => {
      if (request.query === 'reviews.bookinfo.svc.cluster.local') {
        return Promise.resolve(
          sseResponse([
            JSON.stringify({ data: { token: 'That host is missing.' }, event: 'token' }),
            JSON.stringify({ data: { truncated: false }, event: 'end' })
          ])
        );
      }
      return Promise.resolve(
        sseResponse([
          JSON.stringify({ data: { conversation_id: 'conv-1' }, event: 'start' }),
          JSON.stringify({ data: { token: 'Which host should I check?' }, event: 'token' }),
          JSON.stringify({ data: { truncated: false }, event: 'end' })
        ])
      );
    });

    render(<TroubleshootingAnalysis query="Analyze reviews" />);

    await waitFor(() => {
      expect(screen.getByText('Which host should I check?')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply to Kiali AI troubleshooting...' }), {
      target: { value: 'reviews.bookinfo.svc.cluster.local' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('That host is missing.')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ai-troubleshooting-analysis-user')).toHaveTextContent(
      'reviews.bookinfo.svc.cluster.local'
    );
    expect(API.postTroubleshootingChat).toHaveBeenLastCalledWith(
      {
        conversation_id: 'conv-1',
        interaction_mode: 'troubleshoot',
        query: 'reviews.bookinfo.svc.cluster.local'
      },
      expect.any(AbortSignal)
    );
  });

  it('shows the endpoint error without an answer box', async () => {
    (API.postTroubleshootingChat as Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'AI support is not enabled for troubleshooting' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 403
      })
    );

    render(<TroubleshootingAnalysis query="Analyze reviews" />);

    expect(await screen.findByText('AI support is not enabled for troubleshooting')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('ai-troubleshooting-analysis-status')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-troubleshooting-analysis-answer')).not.toBeInTheDocument();
  });
});
