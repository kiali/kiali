import { act, render, screen } from '@testing-library/react';
import type { Mock } from '@rstest/core';

import { ChatSessionUsage as ChatSessionUsageContent } from '../ChatSessionUsage';
import * as API from 'services/Api';

rstest.mock('services/Api', () => ({
  getChatSessionUsage: rstest.fn(),
  getErrorString: rstest.fn(() => 'Unable to load')
}));

describe('ChatSessionUsageContent', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
  });

  it('loads session usage once on mount', async () => {
    (API.getChatSessionUsage as Mock).mockResolvedValue({ data: [] });

    await act(async () => {
      render(<ChatSessionUsageContent />);
    });

    expect(API.getChatSessionUsage).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('No token stats yet')).toBeInTheDocument();
  });
});
