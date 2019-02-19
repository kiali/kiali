import * as React from 'react';
import { shallow } from 'enzyme';
import { NamespaceDropdown } from '../NamespaceDropdown';
import ToolbarDropdown from '../../../components/ToolbarDropdown/ToolbarDropdown';

describe('NamespaceDropdown', () => {
  let wrapper, refresh, setNamespace;
  beforeEach(() => {
    refresh = jest.fn();
    setNamespace = jest.fn();
    wrapper = shallow(
      <NamespaceDropdown refresh={refresh} setNamespace={setNamespace} namespace={''} disabled={false} items={[]} />
    );
  });

  it('renders NamespaceDropdown correctly without custom', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('renders NamespaceDropdown correctly with custom', () => {
    wrapper.setProps({ items: [{ name: 'bookinfo' }, { name: 'istio-system' }] });
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('disable ToolbarDropwdown if no namespaces', () => {
    expect(wrapper.find(ToolbarDropdown).length).toEqual(1);
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['disabled']
    ).toBeTruthy();
    wrapper.setProps({ items: [{ name: 'bookinfo' }] });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['disabled']
    ).toBeFalsy();
    wrapper.setProps({ disabled: true });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['disabled']
    ).toBeTruthy();
  });

  it('set value if namespace selected', () => {
    const ns = 'bookinfo';
    wrapper.setProps({ namespace: ns });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['value']
    ).toBe(ns);
  });

  it('set label if namespace selected', () => {
    const ns = 'bookinfo';
    const label = 'Select a Namespace';
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['label']
    ).toBe(label);
    wrapper.setProps({ namespace: ns });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['label']
    ).toBe(ns);
  });

  it('set items in options in dropdown', () => {
    const namespaces = [{ name: 'bookinfo' }, { name: 'istio-system' }];
    const items: { [key: string]: string } = namespaces.reduce((list, item) => {
      list[item.name] = item.name;
      return list;
    }, {});
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['options']
    ).toEqual({});
    wrapper.setProps({ items: namespaces });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['options']
    ).toEqual(items);
  });

  it('set handleSelect in dropdown', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['handleSelect']
    ).toBe(setNamespace);
  });
});
