import * as React from 'react';
import { shallow } from 'enzyme';
import { TagsControl } from '../TagsControl';
import { FormControl, FieldLevelHelp } from 'patternfly-react';

describe('TagsControls', () => {
  let wrapper, onChangeMock;
  beforeEach(() => {
    onChangeMock = jest.fn();
    wrapper = shallow(<TagsControl onChange={onChangeMock} disable={false} tags={''} />);
  });

  it('renders TagsControl correctly', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('TagsControl has a help for logfmt', () => {
    expect(wrapper.find(FieldLevelHelp)).toHaveLength(1);
  });

  describe('Actions', () => {
    it('FormControl active when the service is selected', () => {
      expect(wrapper.find(FormControl)).toHaveLength(1);
      expect(
        wrapper
          .find(FormControl)
          .first()
          .props()['disabled']
      ).toBeFalsy();
    });

    it('FormControl disabled when is disable', () => {
      wrapper.setProps({ disable: true });
      expect(wrapper.find(FormControl)).toHaveLength(1);
      expect(
        wrapper
          .find(FormControl)
          .first()
          .props()['disabled']
      ).toBeTruthy();
    });

    it('FormControl tags is empty', () => {
      expect(wrapper.find(FormControl)).toHaveLength(1);
      expect(
        wrapper
          .find(FormControl)
          .first()
          .props()['defaultValue']
      ).toBe('');
    });

    it('FormControl tags to be {error: true}', () => {
      wrapper.setProps({ tags: '{error: true}' });
      expect(wrapper.find(FormControl)).toHaveLength(1);
      expect(
        wrapper
          .find(FormControl)
          .first()
          .props()['defaultValue']
      ).toBe('{error: true}');
    });

    it('FormControl call onChange when the value change', () => {
      const event = {
        target: { value: 'new-value' }
      };
      wrapper.find(FormControl).simulate('change', event);
      expect(onChangeMock).toBeCalledWith(event);
    });
  });
});
