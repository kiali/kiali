import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceDropdown } from '../ServiceDropdown';
import ToolbarDropdown from '../../../components/ToolbarDropdown/ToolbarDropdown';

describe('NamespaceDropdown', () => {
  let wrapper, setService;
  beforeEach(() => {
    setService = jest.fn();
    wrapper = shallow(<ServiceDropdown setService={setService} service={''} activeNamespaces={[]} disabled={false} />);
  });

  it('renders ServiceDropdown correctly without custom', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
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

  it('handleSelect should be setService', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['handleSelect']
    ).toBe(setService);
  });
});
