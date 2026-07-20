import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom-v5-compat';

import { store } from 'store/ConfigStore';
import { router } from 'app/History';
import { IstioConfigDetailsPage } from '../IstioConfigDetailsPage';
import * as API from 'services/Api';
import type { IstioConfigId } from 'types/IstioConfigDetails';

rstest.mock('services/Api', () => ({
  getIstioConfigDetail: rstest.fn(),
  updateIstioConfigDetail: rstest.fn(),
  deleteIstioConfigDetail: rstest.fn(),
  getErrorString: rstest.fn(() => 'error')
}));

rstest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange?: (value: string | undefined) => void }) => (
    <textarea
      data-test="istio-config-editor-mock"
      onChange={e => onChange?.(e.target.value)}
      defaultValue="apiVersion: networking.istio.io/v1"
    />
  )
}));

const istioConfigId: IstioConfigId = {
  namespace: 'bookinfo',
  objectGroup: 'networking.istio.io',
  objectVersion: 'v1',
  objectKind: 'VirtualService',
  objectName: 'reviews'
};

const configDetail = {
  cluster: 'cluster-default',
  namespace: { name: 'bookinfo', cluster: 'cluster-default' },
  permissions: { create: true, delete: true, update: true },
  validation: {
    name: 'reviews',
    objectGVK: { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' },
    valid: true,
    checks: []
  },
  references: { objectReferences: [], serviceReferences: [], workloadReferences: [] },
  help: [],
  resource: {
    kind: 'VirtualService',
    apiVersion: 'networking.istio.io/v1',
    metadata: { name: 'reviews', namespace: 'bookinfo' },
    spec: { hosts: ['reviews'] }
  }
};

const renderPage = (
  initialPath = '/namespaces/bookinfo/istio/networking.istio.io/v1/virtualservices/reviews'
): ReturnType<typeof render> & { router: ReturnType<typeof createMemoryRouter> } => {
  const router = createMemoryRouter(
    [
      {
        path: '/namespaces/:namespace/istio/:objectGroup/:objectVersion/:objectKind/:objectName',
        element: <IstioConfigDetailsPage istioConfigId={istioConfigId} />
      },
      {
        path: '/istio',
        element: <div data-test="istio-list">Istio list</div>
      },
      {
        path: '/workloads',
        element: <div data-test="workloads-page">Workloads</div>
      }
    ],
    { initialEntries: [initialPath] }
  );

  return {
    router,
    ...render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    )
  };
};

describe('IstioConfigDetailsPage unsaved changes', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    (API.getIstioConfigDetail as Mock).mockResolvedValue({ data: configDetail });
  });

  it('shows reload confirmation when Reload is clicked with dirty YAML', async () => {
    renderPage();

    await waitFor(() => expect(API.getIstioConfigDetail).toHaveBeenCalled());
    await screen.findByTestId('istio-config-editor-mock');

    fireEvent.change(screen.getByTestId('istio-config-editor-mock'), {
      target: { value: 'apiVersion: networking.istio.io/v1\nkind: VirtualService\n' }
    });

    fireEvent.click(screen.getByTestId('reload-istio-config'));

    expect(await screen.findByTestId('unsaved-changes-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-unsaved')).toHaveTextContent('Reload');

    const fetchCount = (API.getIstioConfigDetail as Mock).mock.calls.length;
    fireEvent.click(screen.getByTestId('cancel-unsaved'));

    await waitFor(() => expect(screen.queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument());
    expect(API.getIstioConfigDetail).toHaveBeenCalledTimes(fetchCount);
  });

  it('reloads YAML after confirming the reload modal', async () => {
    renderPage();

    await screen.findByTestId('istio-config-editor-mock');

    fireEvent.change(screen.getByTestId('istio-config-editor-mock'), {
      target: { value: 'apiVersion: networking.istio.io/v1\nkind: VirtualService\n' }
    });

    fireEvent.click(screen.getByTestId('reload-istio-config'));
    await screen.findByTestId('unsaved-changes-modal');

    const fetchCount = (API.getIstioConfigDetail as Mock).mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-unsaved'));
    });

    await waitFor(() => expect(API.getIstioConfigDetail).toHaveBeenCalledTimes(fetchCount + 1));
    await waitFor(() => expect(screen.queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument());
  });

  it('blocks Cancel navigation when YAML is dirty and leave confirm proceeds', async () => {
    const navigateSpy = rstest.spyOn(router, 'navigate').mockImplementation(() => undefined as never);

    renderPage();

    await screen.findByTestId('istio-config-editor-mock');

    fireEvent.change(screen.getByTestId('istio-config-editor-mock'), {
      target: { value: 'apiVersion: networking.istio.io/v1\nkind: VirtualService\n' }
    });

    fireEvent.click(screen.getByTestId('cancel-istio-config'));

    expect(await screen.findByTestId('unsaved-changes-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-unsaved')).toHaveTextContent('Leave');
    expect(navigateSpy).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-unsaved'));
    });

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/istio?namespaces=bookinfo'));
    await waitFor(() => expect(screen.queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument());

    navigateSpy.mockRestore();
  });
});
