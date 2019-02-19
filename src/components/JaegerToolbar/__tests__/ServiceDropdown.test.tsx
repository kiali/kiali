import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceDropdown } from '../ServiceDropdown';
import ToolbarDropdown from '../../../components/ToolbarDropdown/ToolbarDropdown';

describe('NamespaceDropdown', () => {
  let wrapper, refresh, setService;
  beforeEach(() => {
    refresh = jest.fn();
    setService = jest.fn();
    wrapper = shallow(
      <ServiceDropdown
        refresh={refresh}
        setService={setService}
        service={''}
        activeNamespace={''}
        disabled={false}
        items={[]}
      />
    );
  });

  it('renders ServiceDropdown correctly without custom', () => {
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
    wrapper.setProps({ items: ['details', 'productpage'] });
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

  it('value should be empty', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['value']
    ).toBe('');
  });

  it('label should be service', () => {
    const service = 'details';
    wrapper.setProps({ service: service });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['label']
    ).toBe(service);
  });

  it('options should be items', () => {
    const services = ['details', 'productpage'];
    const items: { [key: string]: string } = services.reduce((list, item) => {
      list[item] = item;
      return list;
    }, {});
    wrapper.setProps({ items: services });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['options']
    ).toEqual(items);
  });

  it('handleSelect should be setService', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['handleSelect']
    ).toBe(setService);
  });
});
