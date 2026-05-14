/* eslint-disable import/first */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

let mockKioskValue = '';

jest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: mockKioskValue } }),
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

import { store } from '../../../store/ConfigStore';
import { ServiceLink } from '../ServiceLink';

let postMessageSpy: jest.SpyInstance;

beforeEach(() => {
  postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  mockKioskValue = '';
  postMessageSpy.mockRestore();
});

const renderServiceLink = (isServiceEntry?: boolean): ReturnType<typeof render> => {
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ServiceLink name="my-svc" namespace="bookinfo" isServiceEntry={isServiceEntry} />
      </MemoryRouter>
    </Provider>
  );
};

describe('ServiceLink badge selection', () => {
  it('renders Service badge for regular services', () => {
    const { container } = renderServiceLink(false);

    const badge = container.querySelector('.pf-v6-c-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('S');
  });

  it('renders ExternalService badge for service entries', () => {
    const { container } = renderServiceLink(true);

    const badge = container.querySelector('.pf-v6-c-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('ES');
  });
});

describe('ServiceLink kiosk navigation', () => {
  beforeEach(() => {
    mockKioskValue = 'https://console.example.com';
  });

  it('sends postMessage with type=External for service entries', () => {
    const { getByText } = renderServiceLink(true);
    fireEvent.click(getByText('bookinfo/my-svc'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('type=External'),
      'https://console.example.com'
    );
  });

  it('sends postMessage without type=External for regular services', () => {
    const { getByText } = renderServiceLink(false);
    fireEvent.click(getByText('bookinfo/my-svc'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.not.stringContaining('type=External'),
      'https://console.example.com'
    );
  });
});
