// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { shallow } from 'enzyme';
import { Link } from 'react-router-dom';

import { TopNavImpl as TopNav } from './TopNav';

describe('<TopNav>', () => {
  const labelGitHub = 'GitHub';
  const githubUrl = 'https://github.com/uber/jaeger';
  const blogUrl = 'https://medium.com/jaegertracing/';
  const labelAbout = 'About Jaeger';
  const dropdownItems = [
    {
      label: 'Docs',
      url: 'http://jaeger.readthedocs.io/en/latest/',
    },
    {
      label: 'Twitter',
      url: 'https://twitter.com/JaegerTracing',
      anchorTarget: '_self',
    },
  ];

  const configMenuGroup = {
    label: labelAbout,
    items: dropdownItems,
  };

  const defaultProps = {
    config: {
      menu: [
        {
          label: labelGitHub,
          url: githubUrl,
          anchorTarget: '_self',
        },
        {
          label: 'Blog',
          url: blogUrl,
        },
        configMenuGroup,
      ],
    },
    router: {
      location: { location: { pathname: 'some-path ' } },
    },
    traceDiff: {},
  };

  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TopNav {...defaultProps} />);
  });

  describe('renders the default menu options', () => {
    it('renders the "Jaeger UI" button', () => {
      const items = wrapper.find(Link).findWhere(link => /Jaeger UI/.test(link.text()));
      expect(items.length).toBe(1);
    });

    it('renders the "Search" button', () => {
      const items = wrapper.find(Link).findWhere(link => /Search/.test(link.text()));
      expect(items.length).toBe(1);
    });

    it('renders the "Dependencies" button', () => {
      const items = wrapper.find(Link).findWhere(link => /Dependencies/.test(link.text()));
      expect(items.length).toBe(1);
    });
  });

  describe('renders the custom menu', () => {
    it('renders the top-level item', () => {
      const item = wrapper.find(`[href="${githubUrl}"]`);
      expect(item.length).toBe(1);
      expect(item.text()).toMatch(labelGitHub);
    });

    it('renders the nested menu items', () => {
      const item = wrapper.find(TopNav.CustomNavDropdown);
      expect(item.length).toBe(1);
      expect(item.prop('label')).toBe(labelAbout);
      expect(item.prop('items')).toBe(dropdownItems);
    });

    it('adds target=_self to top-level item', () => {
      const item = wrapper.find(`[href="${githubUrl}"]`);
      expect(item.length).toBe(1);
      expect(item.find(`[target="_self"]`).length).toBe(1);
    });

    it('sets target=_blank by default', () => {
      const item = wrapper.find(`[href="${blogUrl}"]`);
      expect(item.length).toBe(1);
      expect(item.find(`[target="_blank"]`).length).toBe(1);
    });

    describe('<CustomNavDropdown>', () => {
      beforeEach(() => {
        wrapper = shallow(<TopNav.CustomNavDropdown {...configMenuGroup} />);
      });

      it('renders sub-menu items', () => {
        const subMenu = shallow(wrapper.find('Dropdown').props().overlay);
        dropdownItems.forEach(itemConfig => {
          const item = subMenu.find(`[href="${itemConfig.url}"]`);
          expect(item.length).toBe(1);
          expect(item.prop('target')).toBe(itemConfig.anchorTarget || '_blank');
        });
      });
    });
  });
});
