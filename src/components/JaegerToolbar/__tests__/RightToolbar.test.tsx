import * as React from 'react';
import { shallow } from 'enzyme';
import { RightToolbar } from '../RightToolbar';

const active = { color: '#0088ce' };
describe('RightToolbar', () => {
  let wrapper, onGraphClick, onSummaryClick, onMinimapClick, onSubmit;
  beforeEach(() => {
    onGraphClick = jest.fn();
    onMinimapClick = jest.fn();
    onSummaryClick = jest.fn();
    onSubmit = jest.fn();
    const props = {
      disabled: false,
      graph: false,
      minimap: false,
      summary: false,
      onGraphClick: onGraphClick,
      onSummaryClick: onSummaryClick,
      onMinimapClick: onMinimapClick,
      onSubmit: onSubmit
    };
    wrapper = shallow(<RightToolbar {...props} />);
  });

  it('renders RightToolbar correctly', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  describe('RightToolbar should have buttons with options', () => {
    it('RightToolbar have Graph button', () => {
      let buttonProps = wrapper.find({ title: 'Graph' }).props();
      expect(buttonProps).toBeDefined();
      expect(buttonProps['style']).toBeUndefined();
      expect(buttonProps['onClick']).toBeDefined();
      wrapper.setProps({ graph: true });
      buttonProps = wrapper.find({ title: 'Graph' }).props();
      expect(buttonProps['style']).toEqual(active);
    });

    it('RightToolbar have Minimap button', () => {
      let buttonProps = wrapper.find({ title: 'Minimap' }).props();
      expect(buttonProps).toBeDefined();
      expect(buttonProps['style']).toBeUndefined();
      expect(buttonProps['onClick']).toBeDefined();
      wrapper.setProps({ minimap: true });
      buttonProps = wrapper.find({ title: 'Minimap' }).props();
      expect(buttonProps['style']).toEqual(active);
    });

    it('RightToolbar have Summary button', () => {
      let buttonProps = wrapper.find({ title: 'Summary' }).props();
      expect(buttonProps).toBeDefined();
      expect(buttonProps['style']).toBeUndefined();
      expect(buttonProps['onClick']).toBeDefined();
      wrapper.setProps({ summary: true });
      buttonProps = wrapper.find({ title: 'Summary' }).props();
      expect(buttonProps['style']).toEqual(active);
    });

    it('RightToolbar have Search button', () => {
      let buttonProps = wrapper.find({ title: 'Search' }).props();
      expect(buttonProps).toBeDefined();
      expect(buttonProps['onClick']).toBeDefined();
      expect(buttonProps['style']).toEqual({ borderLeft: '1px solid #d1d1d1', marginLeft: '10px' });
      wrapper.setProps({ disabled: true });
      buttonProps = wrapper.find({ title: 'Search' }).props();
      expect(buttonProps['disabled']).toBeTruthy();
    });
  });
});
