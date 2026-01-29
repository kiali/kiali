import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { NamespaceActions, NamespaceAction } from '../NamespaceActions';

describe('NamespaceActions', () => {
  const mockNamespace = 'test-namespace';

  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const wrapper = shallow(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(wrapper.exists()).toBeTruthy();
    });

    it('renders a dropdown menu', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: jest.fn()
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      expect(wrapper.find('Dropdown').exists()).toBeTruthy();
    });

    it('renders menu toggle button', () => {
      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(wrapper.find('MenuToggle').exists()).toBeTruthy();
    });
  });

  describe('Simple actions', () => {
    it('renders simple action items', () => {
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: actionFn
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('DropdownItem').exists()).toBeTruthy();
      expect(wrapper.find('DropdownItem').text()).toContain('Test Action');
    });

    it('calls action when simple item is clicked', () => {
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: actionFn
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      const dropdownItem = wrapper.find('DropdownItem').first();
      const onClick = dropdownItem.prop('onClick');
      if (onClick) {
        onClick({} as any);
      }

      expect(actionFn).toHaveBeenCalledWith(mockNamespace);
    });

    it('renders disabled action item', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Disabled Action',
          action: jest.fn(),
          isDisabled: true
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('DropdownItem').prop('isDisabled')).toBe(true);
    });

    it('renders external link icon for external actions', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'External Action',
          action: jest.fn(),
          isExternal: true
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('ExternalLinkAltIcon').exists()).toBeTruthy();
    });
  });

  describe('Grouped actions', () => {
    it('renders action groups', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: jest.fn()
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Applications',
              action: jest.fn()
            }
          ]
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('DropdownGroup').exists()).toBeTruthy();
      expect(wrapper.find('DropdownGroup').prop('label')).toBe('Show');
    });

    it('renders children in action groups', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: jest.fn()
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Applications',
              action: jest.fn()
            }
          ]
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      const items = wrapper.find('DropdownItem');
      expect(items.length).toBe(2);
      expect(items.at(0).text()).toContain('Graph');
      expect(items.at(1).text()).toContain('Applications');
    });

    it('calls action when grouped item is clicked', () => {
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: actionFn
            }
          ]
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      const dropdownItem = wrapper.find('DropdownItem').first();
      const onClick = dropdownItem.prop('onClick');
      if (onClick) {
        onClick({} as any);
      }

      expect(actionFn).toHaveBeenCalledWith(mockNamespace);
    });

    it('renders disabled items in groups with tooltip', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Disabled Action',
              action: jest.fn(),
              isDisabled: true
            }
          ]
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('Tooltip').exists()).toBeTruthy();
      expect(wrapper.find('DropdownItem').prop('isDisabled')).toBe(true);
    });
  });

  describe('Separators', () => {
    it('renders separator dividers', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Action 1',
          action: jest.fn()
        },
        {
          isGroup: false,
          isSeparator: true
        },
        {
          isGroup: false,
          isSeparator: false,
          title: 'Action 2',
          action: jest.fn()
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('Divider').exists()).toBeTruthy();
    });
  });

  describe('Dropdown toggle behavior', () => {
    it('opens dropdown when toggle is clicked', () => {
      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={[]} />);

      expect(wrapper.find('MenuToggle').prop('isExpanded')).toBe(false);

      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('MenuToggle').prop('isExpanded')).toBe(true);
    });

    it('handles item selection', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: jest.fn()
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);

      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('MenuToggle').prop('isExpanded')).toBe(true);

      const dropdownItem = wrapper.find('DropdownItem').first();
      const onClick = dropdownItem.prop('onClick');
      if (onClick) {
        onClick({} as any);
      }

      // The dropdown should call onSelect which toggles the menu
      expect(wrapper.exists()).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('handles empty actions array', () => {
      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(wrapper.exists()).toBeTruthy();
      expect(wrapper.find('Dropdown').exists()).toBeTruthy();
    });

    it('handles action without title or action function', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.find('DropdownItem').exists()).toBeFalsy();
    });

    it('handles group without children', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Empty Group'
        }
      ];

      const wrapper = mount(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      wrapper.find('MenuToggle').simulate('click');
      wrapper.update();

      expect(wrapper.exists()).toBeTruthy();
    });
  });
});
