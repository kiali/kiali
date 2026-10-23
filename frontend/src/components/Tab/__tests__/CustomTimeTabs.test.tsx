// Assisted-by: OpenAI Codex
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tab } from '@patternfly/react-core';
import { Provider } from 'react-redux';
import { createStore, type AnyAction, type Store } from 'redux';
import type { TimeRange } from 'types/Common';
import { location, router } from 'app/History';
import { CustomTimeTabsContext, CustomTimeTabsProvider } from '../CustomTimeTabs';
import { UserSettingsActions } from 'actions/UserSettingsActions';

const range = { from: 1792065300000, to: 1792065900000 };
const initialState = { timeRange: { rangeDuration: 300 } };
const makeStore = (): Store<{ timeRange: TimeRange }, AnyAction> =>
  createStore((state: { timeRange: TimeRange } = initialState, action: AnyAction): { timeRange: TimeRange } =>
    action.type === UserSettingsActions.setTimeRange(range).type ? { timeRange: action.payload } : state
  );

const TabActions: React.FC = () => {
  const { tabs, onSelect } = React.useContext(CustomTimeTabsContext);
  return (
    <>
      {tabs.map(tab => (
        <button key={tab.name} onClick={() => onSelect(tab.name, range)}>
          {tab.title}
        </button>
      ))}
      <button onClick={() => onSelect('missing', range)}>Missing</button>
    </>
  );
};

describe('custom time tab destinations', () => {
  let navigate: ReturnType<typeof rstest.spyOn>;
  beforeEach(() => {
    navigate = rstest.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve());
    rstest.spyOn(location, 'getPathname').mockReturnValue('/namespaces/bookinfo/workloads/reviews-v1');
    rstest.spyOn(location, 'getSearch').mockReturnValue('?tab=info&clusterName=east&rangeDuration=300&duration=60');
  });
  afterEach(() => {
    rstest.restoreAllMocks();
  });

  const setup = (
    tabs: React.ReactNode
  ): ReturnType<typeof render> & { onSelect: ReturnType<typeof rstest.fn>; store: ReturnType<typeof makeStore> } => {
    const store = makeStore();
    const onSelect = rstest.fn();
    const view = render(
      <Provider store={store}>
        <CustomTimeTabsProvider
          names={['metrics', 'logs', 'traces', 'missing']}
          tabMap={{ metrics: 1, logs: 2, traces: 3, missing: 4 }}
          tabName="tab"
          onSelect={onSelect}
          tabs={tabs}
        >
          <TabActions />
        </CustomTimeTabsProvider>
      </Provider>
    );
    return { ...view, store, onSelect };
  };

  it('offers only rendered, enabled, internal custom-time tabs', () => {
    setup([
      <Tab key="metrics" eventKey={1} title="Metrics" />,
      <Tab key="logs" eventKey={2} title="Logs" isDisabled />,
      <Tab key="traces" eventKey={3} title="Traces" href="https://tracing" />
    ]);
    expect(screen.getByRole('button', { name: 'Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Traces' })).not.toBeInTheDocument();
  });

  it('does not change shared time state until a destination is selected', () => {
    const { store } = setup(<Tab eventKey={2} title="Logs" />);
    expect(store.getState()).toEqual(initialState);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('excludes hidden and aria-disabled tabs', () => {
    setup([
      <Tab key="logs" eventKey={2} title="Logs" isHidden />,
      <Tab key="traces" eventKey={3} title="Traces" isAriaDisabled />
    ]);
    expect(screen.queryByRole('button', { name: 'Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Traces' })).not.toBeInTheDocument();
  });

  it('sets shared bounds and preserves cluster and duration when activating Logs', () => {
    const { store, onSelect } = setup(<Tab eventKey={2} title="Logs" />);
    fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(store.getState().timeRange).toEqual(range);
    expect(onSelect).toHaveBeenCalledWith('logs');
    const url = new URL(navigate.mock.calls[0][0] as string, 'http://kiali');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tab: 'logs',
      clusterName: 'east',
      duration: '60',
      from: String(range.from),
      to: String(range.to)
    });
  });

  it('refuses navigation and shared-range changes for a nonexistent tab', () => {
    const { store, onSelect } = setup(<Tab eventKey={1} title="Metrics" />);
    fireEvent.click(screen.getByRole('button', { name: 'Missing' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(store.getState()).toEqual(initialState);
  });

  it('removes a destination when its tab is no longer rendered', () => {
    const { rerender, store, onSelect } = setup(<Tab eventKey={3} title="Traces" />);
    expect(screen.getByRole('button', { name: 'Traces' })).toBeInTheDocument();
    rerender(
      <Provider store={store}>
        <CustomTimeTabsProvider names={['traces']} tabMap={{ traces: 3 }} tabName="tab" onSelect={onSelect} tabs={[]}>
          <TabActions />
        </CustomTimeTabsProvider>
      </Provider>
    );
    expect(screen.queryByRole('button', { name: 'Traces' })).not.toBeInTheDocument();
  });
});
