import * as React from 'react';
import { shallow } from 'enzyme';
import SocialLink from '../SocialLink';
import { socialLinks } from '../../../config';

const socialLinksLength = socialLinks.length;
const wrapper = shallow(<SocialLink />);

describe('#Badge render correctly with data', () => {
  it('should render badge', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('should contain exactly the same number of links provided in the configuration', () => {
    expect(wrapper.find('li').length).toEqual(socialLinksLength);
  });

  it('should contain an Icon with link in each socialLink', () => {
    wrapper.find('li').forEach(link => {
      expect(link.find('Icon').length === 1).toBeTruthy();
      expect(link.find('a').length === 1).toBeTruthy();
    });
  });
});
