/* eslint-disable import/first */
import { render } from '@testing-library/react';
import { Tab } from '@patternfly/react-core';
import { Provider } from 'react-redux';
import type { Mock } from '@rstest/core';

rstest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: '' } }),
    dispatch: rstest.fn(),
    subscribe: rstest.fn(),
    replaceReducer: rstest.fn()
  },
  persistor: { persist: rstest.fn() }
}));

rstest.mock('config/ServerConfig', () => ({
  isMultiCluster: false,
  serverConfig: { ambientEnabled: false }
}));

import { store } from '../../../store/ConfigStore';
import { ParameterizedTabs } from '../Tabs';

const defaultProps = {
  activeTab: 'info',
  defaultTab: 'info',
  id: 'test-tabs',
  onSelect: rstest.fn(),
  tabMap: { info: 0, traffic: 1 }
};

const renderTabs = (actionsToolbar?: React.ReactNode): ReturnType<typeof render> => {
  return render(
    <Provider store={store as any}>
      <ParameterizedTabs {...defaultProps} actionsToolbar={actionsToolbar}>
        <Tab eventKey={0} title="Info" />
        <Tab eventKey={1} title="Traffic" />
      </ParameterizedTabs>
    </Provider>
  );
};

describe('ParameterizedTabs actionsToolbar rendering', () => {
  it('renders actionsToolbar when prop is provided', () => {
    const { container } = renderTabs(<span data-testid="toolbar-action">Action</span>);

    expect(container.querySelector('[data-testid="toolbar-action"]')).toBeTruthy();
  });

  it('does not render actionsToolbar when prop is not provided', () => {
    const { queryByTestId } = renderTabs();

    expect(queryByTestId('toolbar-action')).toBeNull();
  });

  it('hides actionsToolbar in kiosk mode', () => {
    (store.getState as Mock) = rstest.fn(() => ({ globalState: { kiosk: 'https://parent.example.com' } }));

    const { queryByTestId } = renderTabs(<span data-testid="toolbar-action">Action</span>);

    expect(queryByTestId('toolbar-action')).toBeNull();

    (store.getState as Mock) = rstest.fn(() => ({ globalState: { kiosk: '' } }));
  });
});
