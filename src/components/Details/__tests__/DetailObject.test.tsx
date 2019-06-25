import * as React from 'react';
import { shallow } from 'enzyme';
import { Icon } from 'patternfly-react';
import { default as DetailObject } from '../DetailObject';
import { PfColors } from '../../Pf/PfColors';
import { DestinationWeight } from '../../../types/IstioObjects';
import { shallowToJson } from 'enzyme-to-json';

describe('DetailObject test', () => {
  const detail: DestinationWeight = {
    destination: {
      host: 'reviews',
      subset: 'v1',
      port: {
        number: 22,
        name: 'ssh'
      }
    },
    weight: 85
  };

  const mockRandom = () => {
    const mockMath = Object.create(global.Math);
    mockMath.random = () => 0.8;
    global.Math = mockMath;
  };

  it('prints a nested list with all attributes in the detail', () => {
    mockRandom();

    const wrapper = shallow(<DetailObject name={name} detail={detail} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    expect(wrapper.html()).toContain('<span class="text-capitalize">[host]</span>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[subset]</span>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[weight]</span>');

    expect(wrapper.html()).toContain('<strong class="text-capitalize">port</strong>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[number]</span>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[name]</span>');
  });

  it("doesn't print excluded fields", () => {
    mockRandom();

    const wrapper = shallow(<DetailObject name={name} detail={detail} exclude={['port']} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    expect(wrapper.html()).toContain('<span class="text-capitalize">[host]</span>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[subset]</span>');
    expect(wrapper.html()).toContain('<span class="text-capitalize">[weight]</span>');

    expect(wrapper.html()).not.toContain('<strong class="text-capitalize">port</strong>');
    expect(wrapper.html()).not.toContain('<span class="text-capitalize">[number]</span>');
    expect(wrapper.html()).not.toContain('<span class="text-capitalize">[name]</span>');
  });

  it('prints an alert message', () => {
    const validation = {
      message: 'Not all checks passed',
      icon: 'error-circle-o',
      color: PfColors.Red400
    };

    mockRandom();

    const wrapper = shallow(<DetailObject name={name} detail={detail} validation={validation} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    const iconWrapper = wrapper.find(Icon);
    expect(iconWrapper.prop('type')).toEqual('pf');
    expect(iconWrapper.prop('name')).toEqual(validation.icon);
    expect(iconWrapper.parent().html()).toContain(validation.message);
  });

  it("doesn't print any alert message", () => {
    const validation = {
      message: '',
      icon: 'error-circle-o',
      color: PfColors.Red400
    };

    mockRandom();

    const wrapper = shallow(<DetailObject name={name} detail={detail} validation={validation} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    const iconWrapper = wrapper.find(Icon);
    expect(iconWrapper.length).toEqual(0);
  });
});
