import * as React from 'react';
import { act, render, screen } from '@testing-library/react';

import { ChatSessionUsageContent } from '../ChatSessionUsagePage';
import * as API from 'services/Api';

jest.mock('services/Api', () => ({
  getChatSessionUsage: jest.fn(),
  getErrorString: jest.fn(() => 'Unable to load')
}));

describe('ChatSessionUsageContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads session usage once on mount', async () => {
    (API.getChatSessionUsage as jest.Mock).mockResolvedValue({ data: [] });

    await act(async () => {
      render(<ChatSessionUsageContent />);
    });

    expect(API.getChatSessionUsage).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('No token stats yet')).toBeInTheDocument();
  });
});
