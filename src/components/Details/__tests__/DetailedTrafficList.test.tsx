import * as React from 'react';
import { MemoryRouter, Router } from 'react-router';
import { mount } from 'enzyme';
import { ErrorCircleOIcon, CheckCircleIcon, UnknownIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import DetailedTrafficList, { AppNode, ServiceNode, TrafficItem, WorkloadNode } from '../DetailedTrafficList';
import history from '../../../app/History';
import { NodeType } from '../../../types/Graph';
import { REQUESTS_THRESHOLDS } from '../../../types/Health';
import { PfColors } from '../../Pf/PfColors';

describe('DetailedTrafficList', () => {
  const buildHttpItemWithError = (error: number): TrafficItem => ({
    node: {
      id: 'id1',
      isInaccessible: false,
      namespace: 'ns',
      name: 'workload',
      type: NodeType.WORKLOAD
    },
    traffic: {
      protocol: 'http',
      rates: {
        http: '14',
        httpPercentErr: error.toString()
      },
      responses: {}
    }
  });

  const buildGrpcItemWithError = (error: number): TrafficItem => ({
    node: {
      id: 'id2',
      isInaccessible: false,
      namespace: 'ns',
      name: 'workload',
      type: NodeType.WORKLOAD
    },
    traffic: {
      protocol: 'grpc',
      rates: {
        grpc: '14',
        grpcPercentErr: error.toString()
      },
      responses: {}
    }
  });

  const buildTcpItem = (): TrafficItem => ({
    node: {
      id: 'id3',
      isInaccessible: false,
      namespace: 'ns',
      name: 'workload',
      type: NodeType.WORKLOAD
    },
    traffic: {
      protocol: 'tcp',
      rates: {
        tcp: '10000'
      },
      responses: {}
    }
  });

  const buildUnknownProtocolItem = (): TrafficItem => ({
    node: {
      id: 'id4',
      isInaccessible: false,
      namespace: 'ns',
      name: 'workload',
      type: NodeType.WORKLOAD
    },
    traffic: {
      protocol: 'http'
    }
  });

  const buildUnknownNode = (): TrafficItem => ({
    node: {
      id: 'id5',
      namespace: 'ns',
      name: 'unknown',
      type: NodeType.UNKNOWN
    },
    traffic: {
      protocol: 'http'
    }
  });

  const buildServiceNode = (): TrafficItem => ({
    node: {
      id: 'id6',
      namespace: 'ns',
      name: 'svc1',
      type: NodeType.SERVICE,
      isInaccessible: false
    },
    traffic: {
      protocol: 'http'
    }
  });

  const buildServiceEntryNode = (): TrafficItem => ({
    node: {
      id: 'id6',
      namespace: 'ns',
      name: 'svc1',
      type: NodeType.SERVICE,
      isInaccessible: false,
      isServiceEntry: 'MESH_EXTERNAL',
      destServices: [
        { namespace: 'foo', name: 'foo.com' },
        { namespace: 'foo', name: 'bar.com' }
      ]
    },
    traffic: {
      protocol: 'http'
    }
  });

  const buildAppNode = (): TrafficItem => ({
    node: {
      id: 'id7',
      namespace: 'ns',
      name: 'app3',
      type: NodeType.APP,
      version: 'first',
      isInaccessible: false
    },
    traffic: {
      protocol: 'http'
    }
  });

  it('renders "not enough traffic" row if empty traffic is received', () => {
    const wrapper = mount(<DetailedTrafficList direction={'inbound'} traffic={[]} />);
    const cell = wrapper.find('BodyCell').at(0);
    expect(cell.render().text().trim()).toBe('Not enough inbound traffic to generate info');
  });

  it('renders "source" header if direction is inbound', () => {
    const wrapper = mount(<DetailedTrafficList direction={'inbound'} traffic={[]} />);

    const header = wrapper.find('HeaderCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    expect(header.render().text()).toBe('SOURCE');
  });

  it('renders "destination" header if direction is outbound', () => {
    const wrapper = mount(<DetailedTrafficList direction={'outbound'} traffic={[]} />);

    const header = wrapper.find('HeaderCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    expect(header.render().text()).toBe('DESTINATION');
  });

  it('renders green status if HTTP traffic has no errors', () => {
    const trafficItem = buildHttpItemWithError(REQUESTS_THRESHOLDS.degraded / 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );
    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<CheckCircleIcon size={'md'} color={PfColors.Green400} />)).toBeTruthy();
  });

  it('renders warning status if HTTP traffic has errors below error threshold', () => {
    const trafficItem = buildHttpItemWithError((REQUESTS_THRESHOLDS.degraded + REQUESTS_THRESHOLDS.failure) / 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<WarningTriangleIcon size={'md'} color={PfColors.Orange400} />)).toBeTruthy();
  });

  it('renders error status if HTTP traffic has errors above error threshold', () => {
    const trafficItem = buildHttpItemWithError(REQUESTS_THRESHOLDS.failure * 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<ErrorCircleOIcon size={'md'} color={PfColors.Red100} />)).toBeTruthy();
  });

  it('renders green status if GRPC traffic has no errors', () => {
    const trafficItem = buildGrpcItemWithError(REQUESTS_THRESHOLDS.degraded / 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<CheckCircleIcon size={'md'} color={PfColors.Green400} />)).toBeTruthy();
  });

  it('renders warning status if GRPC traffic has errors below error threshold', () => {
    const trafficItem = buildGrpcItemWithError((REQUESTS_THRESHOLDS.degraded + REQUESTS_THRESHOLDS.failure) / 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<WarningTriangleIcon size={'md'} color={PfColors.Orange400} />)).toBeTruthy();
  });

  it('renders error status if GRPC traffic has errors above error threshold', () => {
    const trafficItem = buildGrpcItemWithError(REQUESTS_THRESHOLDS.failure * 2);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<ErrorCircleOIcon size={'md'} color={PfColors.Red100} />)).toBeTruthy();
  });

  it('renders unknown status if traffic is TCP or unknown', () => {
    // TCP
    let trafficItem = buildTcpItem();
    let wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    let cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<UnknownIcon size={'md'} />)).toBeTruthy();

    // Unknown
    trafficItem = buildUnknownProtocolItem();
    wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    cell = wrapper.find('BodyCell').at(DetailedTrafficList.STATUS_COLUMN_IDX);
    expect(cell.contains(<UnknownIcon size={'md'} />)).toBeTruthy();
  });

  it('renders traffic type correctly', () => {
    // HTTP
    let trafficItem = buildHttpItemWithError(0);
    let wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    let cell = wrapper.find('BodyCell').at(DetailedTrafficList.PROTOCOL_COLUMN_IDX);
    expect(cell.render().text()).toBe('HTTP');

    // GRPC
    trafficItem = buildGrpcItemWithError(0);
    wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    cell = wrapper.find('BodyCell').at(DetailedTrafficList.PROTOCOL_COLUMN_IDX);
    expect(cell.render().text()).toBe('GRPC');

    // TCP
    trafficItem = buildTcpItem();
    wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    cell = wrapper.find('BodyCell').at(DetailedTrafficList.PROTOCOL_COLUMN_IDX);
    expect(cell.render().text()).toBe('TCP');
  });

  it('renders HTTP rps traffic', () => {
    const trafficItem = buildHttpItemWithError(10);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.TRAFFIC_COLUMN_IDX);
    expect(cell.render().text()).toBe('14.00rps | 90.0% success');
  });

  it('renders GRPC rps traffic', () => {
    const trafficItem = buildGrpcItemWithError(20);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.TRAFFIC_COLUMN_IDX);
    expect(cell.render().text()).toBe('14.00rps | 80.0% success');
  });

  it('renders TCP b/s traffic', () => {
    const trafficItem = buildTcpItem();
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.TRAFFIC_COLUMN_IDX);
    expect(cell.render().text()).toBe('10000.00');
  });

  it('renders N/A in traffic column if protocol is unknown', () => {
    const trafficItem = buildUnknownProtocolItem();
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.TRAFFIC_COLUMN_IDX);
    expect(cell.render().text()).toBe('N/A');
  });

  it('renders correctly the name of an "unknown" node', () => {
    const trafficItem = buildUnknownNode();
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    const icon = cell.find('UnknownIcon').first();
    const link = cell.find('Link');

    expect(icon).toBeDefined();
    expect(link.length).toBe(0);
    expect(cell.render().text().trim()).toBe('unknown');
  });

  it('renders correctly the name of an app node with version', () => {
    const trafficItem = buildAppNode();
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    const icon = cell.find('ApplicationsIcon').first();
    const link = cell.find('Link').first();

    expect(icon).toBeDefined();
    expect(link.prop('to')).toBe('/namespaces/ns/applications/app3');
    expect(cell.render().text().trim()).toBe('app3 / first');
  });

  it('renders correctly the name of an app node without version', () => {
    const trafficItem = buildAppNode();
    (trafficItem.node as AppNode).version = '';

    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    const icon = cell.find('ApplicationsIcon').first();
    const link = cell.find('Link').first();

    expect(icon).toBeDefined();
    expect(link.prop('to')).toBe('/namespaces/ns/applications/app3');
    expect(cell.render().text().trim()).toBe('app3');
  });

  it('renders correctly the name of a workload node', () => {
    const trafficItem = buildHttpItemWithError(0);
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    const icon = cell.find('BundleIcon').first();
    const link = cell.find('Link').first();

    expect(icon).toBeDefined();
    expect(link.prop('to')).toBe('/namespaces/ns/workloads/workload');
    expect(cell.render().text().trim()).toBe('workload');
  });

  it('renders correctly the name of a service node', () => {
    const trafficItem = buildServiceNode();
    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
      </MemoryRouter>
    );

    const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
    const icon = cell.find('ServiceIcon').first();
    const link = cell.find('Link').first();

    expect(icon).toBeDefined();
    expect(link.prop('to')).toBe('/namespaces/ns/services/svc1');
    expect(cell.render().text().trim()).toBe('svc1');
  });

  it('renders metrics link of an app node', () => {
    const trafficItem = buildAppNode();

    history.push('/myPrefix/foo?param=1');
    const wrapper = mount(
      <Router history={history}>
        <>
          <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
          <DetailedTrafficList direction={'inbound'} traffic={[trafficItem]} />
        </>
      </Router>
    );

    let cell = wrapper
      .find('DetailedTrafficList')
      .first()
      .find('BodyCell')
      .at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    let link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/myPrefix/foo?tab=out_metrics&bylbl=destination_app%3Dapp3');

    cell = wrapper.find('DetailedTrafficList').last().find('BodyCell').at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/myPrefix/foo?tab=in_metrics&bylbl=source_app%3Dapp3');
  });

  it('renders metrics link of a workload node', () => {
    const trafficItem = buildHttpItemWithError(0);

    const wrapper = mount(
      <MemoryRouter>
        <>
          <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
          <DetailedTrafficList direction={'inbound'} traffic={[trafficItem]} />
        </>
      </MemoryRouter>
    );

    let cell = wrapper
      .find('DetailedTrafficList')
      .first()
      .find('BodyCell')
      .at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    let link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/namespaces/ns/workloads/workload?tab=in_metrics');

    cell = wrapper.find('DetailedTrafficList').last().find('BodyCell').at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/namespaces/ns/workloads/workload?tab=out_metrics');
  });

  it('renders metrics link of a service node', () => {
    const trafficItem = buildServiceNode();

    history.push('/myPrefix/foo?param=1');
    const wrapper = mount(
      <Router history={history}>
        <>
          <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
          <DetailedTrafficList direction={'inbound'} traffic={[trafficItem]} />
        </>
      </Router>
    );

    let cell = wrapper
      .find('DetailedTrafficList')
      .first()
      .find('BodyCell')
      .at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    let link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/myPrefix/foo?tab=out_metrics&bylbl=destination_service_name%3Dsvc1');

    cell = wrapper.find('DetailedTrafficList').last().find('BodyCell').at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    link = cell.find('Link');
    expect(link.first().prop('to')).toBe('/namespaces/ns/services/svc1?tab=metrics');
  });

  it('renders metrics link of a service entry node', () => {
    const trafficItem = buildServiceEntryNode();

    history.push('/myPrefix/foo?param=1');
    const wrapper = mount(
      <Router history={history}>
        <>
          <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
          <DetailedTrafficList direction={'inbound'} traffic={[trafficItem]} />
        </>
      </Router>
    );

    let cell = wrapper
      .find('DetailedTrafficList')
      .first()
      .find('BodyCell')
      .at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    let link = cell.find('Link');
    expect(link.first().prop('to')).toBe(
      '/myPrefix/foo?tab=out_metrics&bylbl=destination_service_name%3Dfoo.com%2Cbar.com'
    );

    cell = wrapper.find('DetailedTrafficList').last().find('BodyCell').at(DetailedTrafficList.METRICS_LINK_COLUMN_IDX);
    link = cell.find('Link');
    expect(link.length).toBe(0);
  });

  it("doesn't render link for inaccessible nodes", () => {
    const trafficItems = [
      buildAppNode(), // an App
      buildServiceNode(), // a service
      buildUnknownProtocolItem() // and a workload
    ];

    trafficItems.forEach(trafficItem => {
      (trafficItem.node as AppNode | WorkloadNode | ServiceNode).isInaccessible = true;
      const wrapper = mount(
        <MemoryRouter>
          <DetailedTrafficList direction={'outbound'} traffic={[trafficItem]} />
        </MemoryRouter>
      );

      const cell = wrapper.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
      const link = cell.find('Link');

      expect(link.length).toBe(0);
      expect(cell.render().text().trim()).toBe(trafficItem.node.name);
    });
  });

  it('sorts traffic list by name, regardless of node type', () => {
    const trafficItems = [
      buildAppNode(), // an app
      buildAppNode(), // another app
      buildServiceNode(), // a service
      buildUnknownProtocolItem() // and a workload
    ];

    trafficItems[0].node.name = 'epsilon';
    trafficItems[1].node.name = 'gamma';
    trafficItems[2].node.name = 'alpha';
    trafficItems[3].node.name = 'theta';

    trafficItems[1].node.id += 'x'; // to avoid warnings in the console

    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={trafficItems} />
      </MemoryRouter>
    );
    const rows = wrapper.find('BodyRow');
    const rowNames: string[] = [];
    rows.forEach(row => {
      const cell = row.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
      rowNames.push(cell.render().text().trim());
    });

    expect(rowNames.join()).toBe('alpha,epsilon / first,gamma / first,theta');
  });

  it('sorts first level items alphabetically, and groups and sorts second level items', () => {
    const trafficItems = [
      buildAppNode(),
      buildServiceNode(),
      buildAppNode(),
      buildUnknownProtocolItem(),
      buildUnknownProtocolItem()
    ];

    trafficItems[0].node.name = 'L1/2'; // first level item
    trafficItems[1].node.name = 'L1/1'; // also, first level item

    trafficItems[2].node.name = 'L2/alpha/2'; // Second level...
    trafficItems[2].proxy = trafficItems[0]; // ...belonging to L1/2

    trafficItems[3].node.name = 'L2/beta/1'; // Second level...
    trafficItems[3].proxy = trafficItems[1]; // ...belonging to L1/1

    trafficItems[4].node.name = 'L2/alpha/1'; // Second level...
    trafficItems[4].proxy = trafficItems[1]; // ...belonging to L1/1

    // to avoid warnings in the console for duplicated keys
    trafficItems[2].node.id += 'x';
    trafficItems[4].node.id += 'x';

    const wrapper = mount(
      <MemoryRouter>
        <DetailedTrafficList direction={'outbound'} traffic={trafficItems} />
      </MemoryRouter>
    );

    const rows = wrapper.find('BodyRow');
    const rowNames: string[] = [];
    rows.forEach(row => {
      const cell = row.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX);
      rowNames.push(cell.render().text().trim());
    });

    expect(rowNames.join()).toBe('L1/1,L2/alpha/1,L2/beta/1,L1/2 / first,L2/alpha/2 / first');
  });
});
