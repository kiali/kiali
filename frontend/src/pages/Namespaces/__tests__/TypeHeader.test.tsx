import * as React from 'react';
import { shallow } from 'enzyme';
import { TypePopoverBody, TypePopoverHeader } from '../TypeHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('TypePopoverHeader', () => {
  it('renders namespace type heading', () => {
    const wrapper = shallow(<TypePopoverHeader />);
    expect(wrapper.text()).toContain('Namespace type');
  });
});

describe('TypePopoverBody', () => {
  it('renders without crashing', () => {
    const wrapper = shallow(<TypePopoverBody />);
    expect(wrapper.exists()).toBeTruthy();
  });

  it('contains CP (Control plane) description', () => {
    const wrapper = shallow(<TypePopoverBody />);
    expect(wrapper.text()).toContain('CP');
    expect(wrapper.text()).toContain('Control plane');
    expect(wrapper.text()).toContain('Istio control plane');
  });

  it('contains DP (Data plane) description', () => {
    const wrapper = shallow(<TypePopoverBody />);
    expect(wrapper.text()).toContain('DP');
    expect(wrapper.text()).toContain('Data plane');
    expect(wrapper.text()).toContain('Namespace is part of the mesh');
  });

  it('contains Empty description', () => {
    const wrapper = shallow(<TypePopoverBody />);
    expect(wrapper.text()).toContain('Empty');
    expect(wrapper.text()).toContain('Namespace is not part of the mesh');
  });
});
