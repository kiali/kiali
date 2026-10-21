// Assisted-by: OpenAI Codex
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit'
};

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  ...timeOptions
};

const formatInvestigationTime = (date: Date, selected: Date): string => {
  return date.toDateString() === selected.toDateString()
    ? date.toLocaleTimeString(undefined, timeOptions)
    : date.toLocaleString(undefined, dateTimeOptions);
};

describe('health history click actions', () => {
  const startTime = Date.UTC(2026, 9, 14, 12) / 1000;
  const setup = (
    rangeStart = startTime
  ): ReturnType<typeof render> & { onSelect: ReturnType<typeof rstest.fn>; ribbon: HTMLElement } => {
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
              datapoints={[[rangeStart, 0]]}
              startTime={rangeStart}
              endTime={rangeStart + 3600}
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

  it.each([
    [150, '25%'],
    [450, '75%']
  ])('anchors the popover at click position %s instead of the ribbon center', async (clientX, left) => {
    const { ribbon } = setup();
    fireEvent.click(ribbon, { clientX });
    await screen.findByTestId('health-history-actions');
    expect(screen.getByTestId('health-history-popover-anchor')).toHaveStyle({ left });
  });

  it.each([
    ['same date', new Date(2026, 9, 14, 12, 30, 53), new Date(2026, 9, 14, 12, 25), new Date(2026, 9, 14, 12, 35)],
    [
      'previous date at the start',
      new Date(2026, 9, 14, 0, 2),
      new Date(2026, 9, 13, 23, 57),
      new Date(2026, 9, 14, 0, 7)
    ],
    ['next date at the end', new Date(2026, 9, 14, 23, 58), new Date(2026, 9, 14, 23, 53), new Date(2026, 9, 15, 0, 3)],
    [
      'previous year at the start',
      new Date(2026, 0, 1, 0, 2),
      new Date(2025, 11, 31, 23, 57),
      new Date(2026, 0, 1, 0, 7)
    ]
  ])(
    'shows dates only for range endpoints on a different selected date: %s',
    async (_label, selected, fromDate, toDate) => {
      const from = formatInvestigationTime(fromDate, selected);
      const to = formatInvestigationTime(toDate, selected);
      const { ribbon, onSelect } = setup(selected.getTime() / 1000 - 1800);
      fireEvent.click(ribbon, { clientX: 300 });
      const range = await screen.findByTestId('health-history-investigation-range');
      expect(range).toHaveTextContent(`${from} – ${to}`);
      expect(screen.getByRole('heading', { level: 6 }).textContent).toBe(
        selected.toLocaleString(undefined, dateTimeOptions)
      );
      const replay = screen.getByTestId('health-history-replay');
      const params = new URL(replay.getAttribute('href')!, 'http://kiali').searchParams;
      expect(Number(params.get('replayStart'))).toBe(fromDate.getTime());
      expect(Number(params.get('replayInterval'))).toBe(toDate.getTime() - fromDate.getTime());
      expect(screen.getByRole('combobox', { name: 'Troubleshooting Time Range' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
      expect(onSelect).toHaveBeenCalledWith('logs', { from: fromDate.getTime(), to: toDate.getTime() });
    }
  );

  it.each([
    ['today', new Date(2026, 9, 21, 11, 30), false],
    ['yesterday', new Date(2026, 9, 20, 23, 59), true]
  ])('includes the header date only when the selection is not today: %s', async (_label, selected, showDate) => {
    const now = rstest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 9, 21, 12).getTime());
    try {
      const { ribbon } = setup(selected.getTime() / 1000 - 1800);
      fireEvent.click(ribbon, { clientX: 300 });
      const header = showDate
        ? selected.toLocaleString(undefined, dateTimeOptions)
        : selected.toLocaleTimeString(undefined, timeOptions);
      expect((await screen.findByRole('heading', { level: 6 })).textContent).toBe(header);
    } finally {
      now.mockRestore();
    }
  });

  it('opens help on click and closes it without dismissing the troubleshooting actions', async () => {
    const { ribbon, onSelect } = setup();
    fireEvent.click(ribbon, { clientX: 300 });
    const help = await screen.findByRole('button', { name: 'About the troubleshooting time range' });
    fireEvent.mouseEnter(help);
    fireEvent.focus(help);
    expect(screen.queryByRole('dialog', { name: 'Troubleshooting Time Range' })).not.toBeInTheDocument();
    fireEvent.click(help);
    const popover = await screen.findByRole('dialog', { name: 'Troubleshooting Time Range' });
    const explanation = within(popover).getByText(/Centers a custom time range/);
    fireEvent.click(explanation);
    expect(popover).toBeInTheDocument();
    fireEvent.click(within(popover).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Troubleshooting Time Range' })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('health-history-actions')).toBeInTheDocument();
    fireEvent.click(help);
    await screen.findByRole('dialog', { name: 'Troubleshooting Time Range' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Troubleshooting Time Range' })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('health-history-actions')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changes the window locally, then applies it when opening a detail tab', async () => {
    const { ribbon, onSelect } = setup();
    fireEvent.click(ribbon, { clientX: 300 });
    await screen.findByTestId('health-history-actions');
    fireEvent.change(screen.getByRole('combobox', { name: 'Troubleshooting Time Range' }), {
      target: { value: '1800' }
    });
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
    expect(parseFloat(screen.getByTestId('health-history-popover-anchor').style.left)).toBeCloseTo(100 / 60);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('health-history-actions')).not.toBeInTheDocument());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
