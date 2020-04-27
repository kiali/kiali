import * as React from 'react';
import { shallow } from 'enzyme';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatus } from '../IstioStatus';
import { shallowToJson } from 'enzyme-to-json';
import { PFAlertColor } from '../../Pf/PfColors';

const mockIcon = (componentList: ComponentStatus[]) => {
  return shallow(
    <IstioStatus
      status={componentList}
      lastRefreshAt={848152}
      namespaces={[{ name: 'bookinfo' }, { name: 'istio-system' }]}
      setIstioStatus={jest.fn()}
    />
  );
};

const testSnapshot = (wrapper: any) => {
  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
};

const testTooltip = (wrapper: any) => {
  // Testing the tooltip
  expect(wrapper.name()).toEqual('Tooltip');
  expect(wrapper.props().position).toEqual('left');
  expect(wrapper.props().enableFlip).toEqual(true);

  expect(wrapper.children().length).toEqual(1);
};

const testIcon = (wrapper: any, color: any) => {
  // Icon shown - should be red
  const icon = wrapper.childAt(0);
  expect(icon).toBeDefined();
  expect(icon.name()).toEqual('ResourcesFullIcon');
  expect(icon.props().color).toEqual(color);
};

describe('When core component has a problem', () => {
  it('the Icon shows is displayed in Red', () => {
    const wrapper = mockIcon([
      {
        name: 'grafana',
        status: Status.Healthy,
        is_core: false
      },
      {
        name: 'istio-egressgateway',
        status: Status.Unhealthy,
        is_core: true
      }
    ]);

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, PFAlertColor.Danger);
  });
});

describe('When addon component has a problem', () => {
  it('the Icon shows is displayed in orange', () => {
    const wrapper = mockIcon([
      {
        name: 'grafana',
        status: Status.Unhealthy,
        is_core: false
      },
      {
        name: 'istio-egressgateway',
        status: Status.Healthy,
        is_core: true
      }
    ]);

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, PFAlertColor.Warning);
  });
});

describe('When both core and addon component have problems', () => {
  it('the Icon shows is displayed in red', () => {
    const wrapper = mockIcon([
      {
        name: 'grafana',
        status: Status.Unhealthy,
        is_core: false
      },
      {
        name: 'istio-egressgateway',
        status: Status.Unhealthy,
        is_core: true
      }
    ]);

    testSnapshot(wrapper);
    testTooltip(wrapper);
    testIcon(wrapper, PFAlertColor.Danger);
  });
});

describe('When all components are good', () => {
  it('the Icon shows is displayed in green', () => {
    const wrapper = mockIcon([
      {
        name: 'grafana',
        status: Status.Healthy,
        is_core: false
      },
      {
        name: 'istio-egressgateway',
        status: Status.Healthy,
        is_core: true
      }
    ]);

    expect(wrapper.isEmptyRender()).toBeTruthy();
  });
});
