import * as React from 'react';
import { renderBadgedLink } from '../SummaryLink';
import { GraphNodeData, NodeType } from '../../../types/Graph';
import { PFBadge, PFBadges } from '../../../components/Pf/PfBadges';
import { mount } from 'enzyme';
import { MemoryRouter } from 'react-router-dom';

let defaultGraphData: GraphNodeData;

describe('renderBadgedLink', () => {
  beforeEach(() => {
    defaultGraphData = {
      id: 'testingID',
      nodeType: NodeType.WORKLOAD,
      cluster: 'default-cluster',
      namespace: 'bookinfo'
    };
  });

  it('should generate a link to workload page and badge', () => {
    const node = { ...defaultGraphData, workload: 'details-v1' };
    const expectedLink = `/namespaces/${encodeURIComponent(node.namespace)}/workloads/${encodeURIComponent(
      node.workload!
    )}`;
    const wrapper = mount(<MemoryRouter>{renderBadgedLink(node)}</MemoryRouter>);
    expect(wrapper.find('a').filter(`[href="${expectedLink}"]`).exists()).toBeTruthy();
    expect(
      wrapper
        .find(PFBadge)
        .filterWhere(badge => badge.prop('badge').badge === PFBadges.Workload.badge)
        .exists()
    ).toBeTruthy();
  });

  it('should generate link with link generator', () => {
    const node: GraphNodeData = {
      ...defaultGraphData,
      workload: 'details-v1'
    };
    const linkInfo = { link: '/custom/link/to/url', displayName: 'customDisplay', key: 'key-1-2' };

    const wrapper = mount(<MemoryRouter>{renderBadgedLink(node, undefined, undefined, () => linkInfo)}</MemoryRouter>);
    const linkNode = wrapper.find('a').filter(`[href="${linkInfo.link}"]`);
    expect(linkNode.exists()).toBeTruthy();
    expect(linkNode.text()).toContain(linkInfo.displayName);
    expect(
      wrapper
        .find(PFBadge)
        .filterWhere(badge => badge.prop('badge').badge === PFBadges.Workload.badge)
        .exists()
    ).toBeTruthy();
  });
});
