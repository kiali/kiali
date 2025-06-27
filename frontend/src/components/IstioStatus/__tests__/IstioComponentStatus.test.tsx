import * as React from 'react';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioComponentStatus } from '../IstioComponentStatus';
import { shallowToJson } from 'enzyme-to-json';
import { shallow, ShallowWrapper } from 'enzyme';
import { CLUSTER_DEFAULT } from '../../../types/Graph';

const mockComponent = (cs: ComponentStatus): ShallowWrapper => {
  return shallow(<IstioComponentStatus componentStatus={cs} />);
};

describe('IstioComponentStatus renders', () => {
  it('success icon when core component is running', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.Healthy,
      isCore: true
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('error icon when core component is not running', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.Unhealthy,
      isCore: true
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('error icon when core component is not found', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.NotFound,
      isCore: true
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('success icon when core component is running', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Healthy,
      isCore: false
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('warning icon when core component is not running', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Unhealthy,
      isCore: false
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('warning icon when core component is not found', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.NotFound,
      isCore: false
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('minus icon when core component is not ready', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'core',
      status: Status.NotReady,
      isCore: true
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('minus icon when addon component is not ready', () => {
    const wrapper = mockComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'addon',
      status: Status.NotReady,
      isCore: false
    });

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
