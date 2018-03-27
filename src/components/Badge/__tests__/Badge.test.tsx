import * as React from 'react';
import { shallow } from 'enzyme';
import Badge from '../Badge';

const mockBadge = (leftText = 'my_key', rightText = 'my_value', scale = 0.8, style = 'plastic', color = 'green') => {
  const component = <Badge scale={scale} style={style} color={color} leftText={leftText} rightText={rightText} />;
  return shallow(component);
};

describe('#Badge render correctly with data', () => {
  it('should render badge', () => {
    const wrapper = mockBadge();
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.name()).toEqual('svg');
  });

  it('should render default props', () => {
    const wrapper = mockBadge();
    expect(wrapper.props().zoomAndPan).toEqual('magnify');
    expect(wrapper.props().preserveAspectRatio).toEqual('xMidYMid meet');
    expect(wrapper.props().xmlns).toEqual('http://www.w3.org/2000/svg');
    expect(wrapper.props().version).toEqual('1.0');
    expect(wrapper.props().style).toEqual({ marginLeft: '5px' });
  });

  it('should render correct size', () => {
    const scale = 0.8;
    const minorMargin = scale;
    const majorMargin = 5 * scale;
    const textMargin = minorMargin + majorMargin;
    const fullWidth = textMargin * 4;
    const wrapper = mockBadge();
    expect(wrapper.props().height).toEqual(20 * scale);
    expect(wrapper.props().width).toEqual(fullWidth);
  });

  it('should scale', () => {
    const scale = 1.2;
    const minorMargin = scale;
    const majorMargin = 5 * scale;
    const textMargin = minorMargin + majorMargin;
    const fullWidth = textMargin * 4;
    const wrapper = mockBadge('leftText', 'rightText', scale);
    expect(wrapper.props().height).toEqual(20 * scale);
    expect(wrapper.props().width).toEqual(fullWidth);
  });

  it('should render with text provided', () => {
    const leftText = 'My left text';
    const rightText = 'My right text';
    let wrapper = mockBadge();
    expect(wrapper.text()).not.toContain(leftText);
    expect(wrapper.text()).not.toContain(rightText);
    wrapper = mockBadge(leftText, rightText);
    expect(wrapper.text()).toContain(leftText);
    expect(wrapper.text()).toContain(rightText);
    expect(wrapper.find('text').getElements()[1].props.children).toEqual(leftText);
    expect(wrapper.find('text').getElements()[3].props.children).toEqual(rightText);
  });

  it('should render with style provided', () => {
    let wrapper = mockBadge();
    let linearGradient = wrapper.find('linearGradient').props();
    expect(linearGradient.x2).toEqual('0');
    expect(linearGradient.y2).toEqual('100%');
    if (linearGradient.children) {
      expect(linearGradient.children[0].props.stopOpacity).toEqual('.1');
      expect(linearGradient.children[0].props.stopColor).toEqual('#bbb');
      expect(linearGradient.children[0].props.offset).toEqual('0');
      expect(linearGradient.children[1].props.stopOpacity).toEqual('.1');
      expect(linearGradient.children[1].props.offset).toEqual('1');
    }
    wrapper = mockBadge('', '', 0.8, 'another_style');
    linearGradient = wrapper.find('linearGradient').props();
    expect(linearGradient.x2).toEqual('0');
    expect(linearGradient.y2).toEqual('0');
    if (linearGradient.children) {
      expect(linearGradient.children[0].props.stopOpacity).toEqual('.1');
      expect(linearGradient.children[0].props.stopColor).toEqual('#bbb');
      expect(linearGradient.children[0].props.offset).toEqual('0');
      expect(linearGradient.children[1].props.stopOpacity).toEqual('.1');
      expect(linearGradient.children[1].props.offset).toEqual('1');
    }
  });

  it('should render with a correct rect elements', () => {
    const scale = 1.1;
    const styleType = 'square';
    const color = 'red';
    const minorMargin = scale;
    const majorMargin = 5 * scale;
    const textMargin = minorMargin + majorMargin;
    const fullWidth = textMargin * 4;
    const rightOffset = textMargin * 2;
    const rightWidth = textMargin * 2;
    const height = 20 * scale;
    const borderRadius = 3 * scale * (styleType === 'square' ? 0 : 1);
    const wrapper = mockBadge('', '', scale, styleType, color);
    const rects = wrapper.find('rect').getElements();
    expect(rects[0].props.rx).toEqual(borderRadius);
    expect(rects[0].props.fill).toEqual('#555');
    expect(rects[0].props.width).toEqual(fullWidth);
    expect(rects[0].props.height).toEqual(height);

    expect(rects[1].props.rx).toEqual(borderRadius);
    expect(rects[1].props.x).toEqual(rightOffset);
    expect(rects[1].props.fill).toEqual(color);
    expect(rects[1].props.width).toEqual(rightWidth);
    expect(rects[1].props.height).toEqual(height);

    expect(rects[2].props.x).toEqual(rightOffset);
    expect(rects[2].props.fill).toEqual(color);
    expect(rects[2].props.width).toEqual('13');
    expect(rects[2].props.height).toEqual(height);

    expect(rects[3].props.rx).toEqual(borderRadius);
    expect(rects[3].props.fill).toEqual('url(#a)');
    expect(rects[3].props.width).toEqual(fullWidth);
    expect(rects[3].props.height).toEqual(height);
  });

  it('should render with a font type', () => {
    const scale = 1.1;
    const wrapper = mockBadge('', '', scale);
    const textSize = 11 * scale;
    const gElement = wrapper.find('g').getElements()[0];
    expect(gElement.props.fontSize).toEqual(textSize);
    expect(gElement.props.fontFamily).toEqual('DejaVu Sans,Verdana,Geneva,sans-serif');
    expect(gElement.props.fill).toEqual('#fff');
  });

  it('should render text elements with correct size and props', () => {
    const scale = 1;
    const minorMargin = scale;
    const majorMargin = 5 * scale;
    const textMargin = minorMargin + majorMargin;
    const rightOffset = textMargin * 2;
    const height = 20 * scale;
    const wrapper = mockBadge('', '', scale);
    const firstText = wrapper.find('text').getElements()[0];
    expect(firstText.props.x).toEqual(textMargin);
    expect(firstText.props.y).toEqual(height - majorMargin);
    expect(firstText.props.fill).toEqual('#010101');
    expect(firstText.props.fillOpacity).toEqual('.3');
    const secondText = wrapper.find('text').getElements()[1];
    expect(secondText.props.x).toEqual(textMargin);
    expect(secondText.props.y).toEqual(height - majorMargin - minorMargin);
    const thirdText = wrapper.find('text').getElements()[2];
    expect(thirdText.props.x).toEqual(rightOffset + textMargin);
    expect(thirdText.props.y).toEqual(height - majorMargin);
    expect(thirdText.props.fill).toEqual('#010101');
    expect(thirdText.props.fillOpacity).toEqual('.3');
    const fourthText = wrapper.find('text').getElements()[3];
    expect(fourthText.props.x).toEqual(rightOffset + textMargin);
    expect(fourthText.props.y).toEqual(height - majorMargin - minorMargin);
  });
});
