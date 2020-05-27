import * as React from 'react';
import { ReactWrapper } from 'enzyme';
import TrafficDetails from '../TrafficDetails';
import DetailedTrafficList from '../../Details/DetailedTrafficList';
import { MetricsObjectTypes } from '../../../types/Metrics';
import {
  GraphDefinition,
  GraphEdgeWrapper,
  GraphNodeData,
  GraphNodeWrapper,
  GraphType,
  NodeType,
} from '../../../types/Graph';
import MounterMocker from 'services/__mocks__/MounterMocker';

describe('TrafficDetails', () => {
  const INBOUND_IDX = 0;
  const OUTBOUND_IDX = 1;
  const trafficDetailProps = {
    duration: 60,
    itemType: MetricsObjectTypes.WORKLOAD.valueOf(),
    namespace: 'ns',
    onDurationChanged: jest.fn(),
    onRefresh: jest.fn(),
    workloadName: 'wk',
  };

  const buildGraph = (nodes: GraphNodeData[][]): GraphDefinition => {
    const uniqSet = new Set(([] as GraphNodeData[]).concat(...nodes));
    const uniqNodes = Array.from(uniqSet);

    return {
      duration: 60,
      elements: {
        edges: nodes.map(
          (tuple): GraphEdgeWrapper => ({
            data: {
              id: tuple[0].id + tuple[1].id,
              source: tuple[0].id,
              target: tuple[1].id,
              traffic: {
                protocol: 'http',
              },
            },
          })
        ),
        nodes: uniqNodes.map(
          (value): GraphNodeWrapper => ({
            data: value,
          })
        ),
      },
      graphType: GraphType.WORKLOAD,
      timestamp: 0,
    };
  };

  const buildWorkloadNode = (name: string): GraphNodeData => ({
    id: name,
    nodeType: NodeType.WORKLOAD,
    namespace: 'ns',
    workload: name,
    traffic: [
      {
        protocol: 'http',
      },
    ],
  });

  const buildServiceNode = (name: string): GraphNodeData => ({
    id: name,
    nodeType: NodeType.SERVICE,
    namespace: 'ns',
    service: name,
    traffic: [
      {
        protocol: 'http',
      },
    ],
  });

  const buildServiceEntryNode = (name: string): GraphNodeData => ({
    id: name,
    nodeType: NodeType.SERVICE,
    namespace: 'ns',
    service: name,
    isServiceEntry: 'MESH_INTERNAL',
    traffic: [
      {
        protocol: 'http',
      },
    ],
  });

  const resolveTrafficLists = (wrapper: ReactWrapper): { inboundList: string[]; outboundList: string[] } => {
    const lists = wrapper.find('DetailedTrafficList');
    if (lists.length !== 2) {
      return {
        inboundList: [],
        outboundList: [],
      };
    }

    const inboundRows = lists.at(INBOUND_IDX).find('BodyRow');
    const outboundRows = lists.at(OUTBOUND_IDX).find('BodyRow');

    const toText = (item: ReactWrapper): string => {
      const iconsType = [
        'BundleIcon',
        'ServiceIcon',
        'ApplicationsIcon',
        'ErrorCircleOIcon',
        'InfoAltIcon',
        'CheckCircleIcon',
        'UnknownIcon',
        'WarningTriangleIcon',
      ];
      const elementIcons = iconsType.filter(
        (iconT) =>
          item.find(iconT).length > 0 && item.find(iconT).prop('style')! && item.find(iconT).prop('style')!.marginLeft
      );
      const icon = elementIcons.length > 0 ? item.find(elementIcons[0]).at(0) : undefined;
      if (icon && icon.exists()) {
        return '->' + item.find('Link').first().children().text();
      }

      if (item.find('Link').length === 0) {
        const items = item.find('BodyCell').at(DetailedTrafficList.WORKLOAD_COLUMN_IDX).children();
        return items.length === 0 ? '' : items.last().text();
      }

      return item.find('Link').first().children().text();
    };

    const inboundList = inboundRows.map(toText);
    const outboundList = outboundRows.map(toText);

    return {
      inboundList: inboundList,
      outboundList: outboundList,
    };
  };

  it('pass down empty traffic if graph is empty', (done) => {
    new MounterMocker()
      .addMock('getNodeGraphElements', {
        duration: 60,
        elements: {},
        graphType: GraphType.WORKLOAD,
        timestamp: 0,
      })
      .mountWithStore(<TrafficDetails {...trafficDetailProps} />)
      .run(done, (wrapper) => {
        const lists = wrapper.find('DetailedTrafficList');
        const inboundList = lists.at(INBOUND_IDX);
        const outboundList = lists.at(OUTBOUND_IDX);
        expect(inboundList.prop('traffic')).toHaveLength(0);
        expect(outboundList.prop('traffic')).toHaveLength(0);
      });
  });

  it('pass down empty traffic if graph does not have target node', (done) => {
    const wk1 = buildWorkloadNode('wk1');
    const wk2 = buildWorkloadNode('wk2');
    const traffic = buildGraph([
      [wk1, wk2], // traffic from wk1 to wk2 (no wk involved)
    ]);

    new MounterMocker()
      .addMock('getNodeGraphElements', traffic)
      .mountWithStore(<TrafficDetails {...trafficDetailProps} />)
      .run(done, (wrapper) => {
        const lists = wrapper.find('DetailedTrafficList');
        const inboundList = lists.at(INBOUND_IDX);
        const outboundList = lists.at(OUTBOUND_IDX);
        expect(inboundList.prop('traffic')).toHaveLength(0);
        expect(outboundList.prop('traffic')).toHaveLength(0);
      });
  });

  it('pass down traffic - simple in-out graph one level', (done) => {
    const wk1 = buildWorkloadNode('wk1');
    const wk2 = buildWorkloadNode('wk2');
    const wk = buildWorkloadNode('wk');
    const se = buildServiceEntryNode('seNode');
    const traffic = buildGraph([
      [wk1, wk], // traffic from wk1 to wk (inbound)
      [wk, wk2], // traffic from wk to wk2 (outbound)
      [wk, se], // traffic from wk to seNode (outbound)
    ]);

    new MounterMocker()
      .addMock('getNodeGraphElements', traffic)
      .mountWithStore(<TrafficDetails {...trafficDetailProps} />)
      .run(done, (wrapper) => {
        const { inboundList, outboundList } = resolveTrafficLists(wrapper);
        expect(inboundList).toHaveLength(1);
        expect(inboundList.join()).toEqual('wk1');
        expect(outboundList).toHaveLength(2);
        expect(outboundList.join()).toEqual(' seNode,wk2');
      });
  });

  it('pass down traffic - simple in-out graph two levels', (done) => {
    const wk1 = buildWorkloadNode('wk1');
    const svc1 = buildServiceNode('svc1');
    const wk2 = buildWorkloadNode('wk2');
    const svc2 = buildServiceNode('svc2');
    const wk = buildWorkloadNode('wk');
    const traffic = buildGraph([
      [wk1, svc1], // traffic from wk1 to svc1 (inbound)
      [svc1, wk], // traffic from svc1 to wk (inbound)
      [wk, svc2], // traffic from wk to svc2 (outbound)
      [svc2, wk2], // traffic from svc2 to wk2 (outbound)
    ]);

    new MounterMocker()
      .addMock('getNodeGraphElements', traffic)
      .mountWithStore(<TrafficDetails {...trafficDetailProps} />)
      .run(done, (wrapper) => {
        const { inboundList, outboundList } = resolveTrafficLists(wrapper);
        expect(inboundList).toHaveLength(2);
        expect(inboundList.join()).toEqual('svc1,->wk1');
        expect(outboundList).toHaveLength(2);
        expect(outboundList.join()).toEqual('svc2,->wk2');
      });
  });

  it('pass down traffic - slightly more complex inbound', (done) => {
    const wk1 = buildWorkloadNode('wk1');
    const wk2 = buildWorkloadNode('wk2');
    const wk3 = buildWorkloadNode('wk3');
    const svc1 = buildServiceNode('svc1');
    const svc2 = buildServiceNode('svc2');
    const wk = buildWorkloadNode('wk');
    const traffic = buildGraph([
      [wk1, svc1], // traffic from wk1 to svc1
      [wk2, svc1], // traffic from wk2 to svc1
      [wk2, svc2], // traffic from wk2 to svc2
      [svc2, wk], // traffic from svc2 to wk
      [svc1, wk], // traffic from svc1 to wk
      [wk3, wk], // traffic from wk3 to wk (direct workload to workload traffic)
    ]);

    new MounterMocker()
      .addMock('getNodeGraphElements', traffic)
      .mountWithStore(<TrafficDetails {...trafficDetailProps} />)
      .run(done, (wrapper) => {
        const { inboundList } = resolveTrafficLists(wrapper);
        expect(inboundList).toHaveLength(6);
        expect(inboundList.join()).toEqual('svc1,->wk1,->wk2,svc2,->wk2,wk3');
      });
  });
});
