import * as React from 'react';
import { render } from '@testing-library/react';
import { Tab } from '@patternfly/react-core';
import { Provider } from 'react-redux';

jest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: '' } }),
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    replaceReducer: jest.fn()
  },
  persistor: { persist: jest.fn() }
}));

jest.mock('config/ServerConfig', () => ({
  isMultiCluster: false,
  serverConfig: { ambientEnabled: false }
}));

jest.mock('../../../utils/SearchParamUtils', () => ({
  isKioskMode: jest.fn(() => false)
}));

// eslint-disable-next-line import/first
import { store } from '../../../store/ConfigStore';
// eslint-disable-next-line import/first
import { ParameterizedTabs } from '../Tabs';
// eslint-disable-next-line import/first
import { isKioskMode } from '../../../utils/SearchParamUtils';

const mockedIsKioskMode = isKioskMode as jest.MockedFunction<typeof isKioskMode>;

const defaultProps = {
  activeTab: 'info',
  defaultTab: 'info',
  id: 'test-tabs',
  onSelect: jest.fn(),
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

afterEach(() => {
  mockedIsKioskMode.mockReturnValue(false);
});

describe('ParameterizedTabs actionsToolbar visibility', () => {
  it('renders actionsToolbar when not in kiosk mode', () => {
    mockedIsKioskMode.mockReturnValue(false);

    const { container } = renderTabs(<span data-testid="toolbar-action">Action</span>);

    expect(container.querySelector('[data-testid="toolbar-action"]')).toBeTruthy();
  });

  it('hides actionsToolbar when in kiosk mode', () => {
    mockedIsKioskMode.mockReturnValue(true);

    const { queryByTestId } = renderTabs(<span data-testid="toolbar-action">Action</span>);

    expect(queryByTestId('toolbar-action')).toBeNull();
  });

  it('renders without actionsToolbar when prop is not provided', () => {
    mockedIsKioskMode.mockReturnValue(false);

    const { queryByTestId } = renderTabs();

    expect(queryByTestId('toolbar-action')).toBeNull();
  });
});
