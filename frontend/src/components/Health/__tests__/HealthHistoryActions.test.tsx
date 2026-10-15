// Assisted-by: OpenAI Codex
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HealthHistoryActions } from '../HealthHistoryActions';
import { HealthStatusRibbon } from '../HealthStatusRibbon';
import { CustomTimeTabsContext } from 'components/Tab/CustomTimeTabs';

rstest.mock('hooks/redux', () => ({
  useKialiSelector: () => 60
}));
rstest.mock('components/Link/KialiLink', () => ({
  KialiLink: (props: any) => (
    <a href={props.to} data-test={props.dataTest} onClick={props.onClick}>
      {props.children}
    </a>
  )
}));

describe('health history click actions', () => {
  const startTime = Date.UTC(2026, 9, 14, 12) / 1000;
  const endTime = startTime + 3600;
  const setup = (): ReturnType<typeof render> & { onSelect: ReturnType<typeof rstest.fn>; ribbon: HTMLElement } => {
    const onSelect = rstest.fn();
    const view = render(
      <CustomTimeTabsContext.Provider
        value={{
          tabs: [
            { name: 'logs', title: 'Logs' },
            { name: 'traces', title: 'Traces' }
          ],
          onSelect
        }}
      >
        <HealthHistoryActions healthType="workload" name="reviews-v1" namespace="bookinfo" cluster="east">
          {selectTime => (
            <HealthStatusRibbon
              datapoints={[[startTime, 0]]}
              startTime={startTime}
              endTime={endTime}
              step={60}
              onSelect={selectTime}
            />
          )}
        </HealthHistoryActions>
      </CustomTimeTabsContext.Provider>
    );
    const ribbon = screen.getByTestId('health-ribbon-bar');
    rstest.spyOn(ribbon, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 600 } as DOMRect);
    return { ...view, ribbon, onSelect };
  };

  it('pins the clicked time and defaults to ten minutes without applying shared time', async () => {
    const { ribbon, onSelect } = setup();
    fireEvent.click(ribbon, { clientX: 300 });
    const replay = await screen.findByTestId('health-history-replay');
    const url = new URL(replay.getAttribute('href')!, 'http://kiali');
    expect(url.searchParams.get('replayStart')).toBe(String((startTime + 1500) * 1000));
    expect(url.searchParams.get('replayInterval')).toBe('600000');
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Traces' })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changes the window locally, then applies it when opening a detail tab', async () => {
    const { ribbon, onSelect } = setup();
    fireEvent.click(ribbon, { clientX: 300 });
    await screen.findByTestId('health-history-actions');
    fireEvent.change(screen.getByRole('combobox', { name: 'Troubleshooting window' }), { target: { value: '1800' } });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(onSelect).toHaveBeenCalledWith('logs', { from: (startTime + 900) * 1000, to: (startTime + 2700) * 1000 });
  });

  it('supports selecting a time with the keyboard and dismissing without navigation', async () => {
    const { ribbon, onSelect } = setup();
    fireEvent.keyDown(ribbon, { key: 'Home' });
    fireEvent.keyDown(ribbon, { key: 'ArrowRight' });
    fireEvent.keyDown(ribbon, { key: 'Enter' });
    const replay = await screen.findByTestId('health-history-replay');
    const url = new URL(replay.getAttribute('href')!, 'http://kiali');
    expect(url.searchParams.get('replayStart')).toBe(String((startTime - 240) * 1000));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('health-history-actions')).not.toBeInTheDocument());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
