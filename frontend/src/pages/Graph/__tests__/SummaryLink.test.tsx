import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { renderBadgedLink } from '../SummaryLink';
import { GraphNodeData, NodeType } from '../../../types/Graph';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { store } from '../../../store/ConfigStore';
import { Provider } from 'react-redux';
import { serverConfig, setServerConfig } from '../../../config/ServerConfig';
import { PFBadges } from '../../../components/Pf/PfBadges';

let defaultGraphData: GraphNodeData;

describe('renderBadgedLink', () => {
  beforeEach(() => {
    defaultGraphData = {
      id: 'testingID',
      nodeType: NodeType.WORKLOAD,
      cluster: 'default-cluster',
      namespace: 'bookinfo'
    };

    serverConfig.clusters = {
      'cluster-default': {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: true,
        kialiInstances: [],
        name: 'cluster-default',
        secretName: 'test-secret'
      }
    };
    setServerConfig(serverConfig);
  });

  it('should generate a link to workload page and badge', () => {
    const node = { ...defaultGraphData, workload: 'details-v1' };
    const expectedLink = `/namespaces/${encodeURIComponent(node.namespace)}/workloads/${encodeURIComponent(
      node.workload!
    )}`;
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>{renderBadgedLink(node)}</MemoryRouter>
      </Provider>
    );
    expect(container.querySelector(`a[href="${expectedLink}"]`)).toBeTruthy();
    expect(container.textContent).toContain(PFBadges.Workload.badge);
  });

  it('should generate link with link generator', () => {
    const node: GraphNodeData = {
      ...defaultGraphData,
      workload: 'details-v1'
    };
    const linkInfo = { link: '/custom/link/to/url', displayName: 'customDisplay', key: 'key-1-2' };

    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>{renderBadgedLink(node, undefined, undefined, () => linkInfo)}</MemoryRouter>
      </Provider>
    );
    const link = screen.getByRole('link', { name: 'customDisplay' });
    expect(link.getAttribute('href')).toBe(linkInfo.link);
    expect(within(link).getByText('customDisplay')).toBeInTheDocument();
    expect(container.textContent).toContain(PFBadges.Workload.badge);
  });
});
