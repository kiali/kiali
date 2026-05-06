import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { HistoryManager, URLParam } from 'app/History';
import { HealthComputeDurationMastheadToolbar } from '../HealthComputeDurationMastheadToolbar';

rstest.mock('hooks/redux', () => ({
  useKialiDispatch: rstest.fn()
}));

rstest.mock('utils/HealthComputeDuration', () => ({
  getHealthComputeDurationLabel: rstest.fn(() => '5m'),
  healthComputeDurationValidSeconds: rstest.fn(() => 300)
}));

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string, opts?: { duration?: string }) =>
    opts && opts.duration !== undefined ? `Last ${opts.duration}` : key
}));

const mockDispatch = rstest.fn();
const useKialiDispatchMock = require('hooks/redux').useKialiDispatch as Mock;
const mockValidSecs = require('utils/HealthComputeDuration').healthComputeDurationValidSeconds as Mock;
const mockGetLabel = require('utils/HealthComputeDuration').getHealthComputeDurationLabel as Mock;

describe('HealthComputeDurationMastheadToolbar', () => {
  let setParamSpy: ReturnType<typeof rstest.spyOn>;

  beforeAll(() => {
    setParamSpy = rstest.spyOn(HistoryManager, 'setParam').mockImplementation(() => undefined);
  });

  afterAll(() => {
    setParamSpy.mockRestore();
  });

  beforeEach(() => {
    mockDispatch.mockReset();
    setParamSpy.mockClear();
    mockGetLabel.mockReturnValue('5m');
    mockValidSecs.mockReturnValue(300);
    useKialiDispatchMock.mockReturnValue(mockDispatch);
  });

  it('renders health duration label and children', () => {
    render(
      <HealthComputeDurationMastheadToolbar>
        <button type="button">child</button>
      </HealthComputeDurationMastheadToolbar>
    );
    expect(screen.getByText('Last 5m')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'child' })).toBeInTheDocument();
  });

  it('syncs Redux duration and URL duration on mount', async () => {
    mockValidSecs.mockReturnValue(600);

    const { unmount } = render(
      <HealthComputeDurationMastheadToolbar>
        <span />
      </HealthComputeDurationMastheadToolbar>
    );

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(UserSettingsActions.setDuration(600));
      expect(setParamSpy).toHaveBeenCalledWith(URLParam.DURATION, '600');
    });
    unmount();
  });
});
