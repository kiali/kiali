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
import { KialiLink } from '../KialiLink';

let postMessageSpy: jest.SpyInstance;

beforeEach(() => {
  postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  mockKioskValue = '';
  postMessageSpy.mockRestore();
});

interface RenderProps {
  children: React.ReactNode;
  kioskParams?: string;
  to: string;
}

const renderKialiLink = (props: RenderProps): ReturnType<typeof render> => {
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <KialiLink to={props.to} kioskParams={props.kioskParams}>
          {props.children}
        </KialiLink>
      </MemoryRouter>
    </Provider>
  );
};

describe('KialiLink — standalone (non-kiosk)', () => {
  it('renders a regular link when kiosk is not active', () => {
    mockKioskValue = '';

    const { container } = renderKialiLink({ to: '/details', children: 'Details' });

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toContain('/details');
  });

  it('does not send postMessage in standalone mode', () => {
    mockKioskValue = '';

    const { getByText } = renderKialiLink({ to: '/details', children: 'Details' });
    fireEvent.click(getByText('Details'));

    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

describe('KialiLink — kiosk mode', () => {
  beforeEach(() => {
    mockKioskValue = 'https://console.example.com';
  });

  it('renders a button instead of a link in kiosk mode', () => {
    const { container } = renderKialiLink({ to: '/details', children: 'Details' });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });

  it('sends postMessage with the base path when no kioskParams', () => {
    const { getByText } = renderKialiLink({ to: '/details', children: 'Details' });
    fireEvent.click(getByText('Details'));

    expect(postMessageSpy).toHaveBeenCalledWith('/details', 'https://console.example.com');
  });

  it('appends kioskParams with ? when path has no query string', () => {
    const { getByText } = renderKialiLink({
      to: '/workloads/ns/my-workload',
      kioskParams: 'type=Deployment',
      children: 'My Workload'
    });

    fireEvent.click(getByText('My Workload'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      '/workloads/ns/my-workload?type=Deployment',
      'https://console.example.com'
    );
  });

  it('appends kioskParams with & when path already has query params', () => {
    const { getByText } = renderKialiLink({
      to: '/workloads?ns=bookinfo',
      kioskParams: 'type=ReplicaSet',
      children: 'Workloads'
    });

    fireEvent.click(getByText('Workloads'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      '/workloads?ns=bookinfo&type=ReplicaSet',
      'https://console.example.com'
    );
  });

  it('does not alter path when kioskParams is undefined', () => {
    const { getByText } = renderKialiLink({ to: '/services/ns/my-svc', children: 'My Service' });
    fireEvent.click(getByText('My Service'));

    expect(postMessageSpy).toHaveBeenCalledWith('/services/ns/my-svc', 'https://console.example.com');
  });

  it('does not alter path when kioskParams is an empty string', () => {
    const { getByText } = renderKialiLink({
      to: '/details',
      kioskParams: '',
      children: 'Empty Params'
    });

    fireEvent.click(getByText('Empty Params'));

    expect(postMessageSpy).toHaveBeenCalledWith('/details', 'https://console.example.com');
  });
});
