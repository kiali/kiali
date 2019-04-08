import * as React from 'react';
import { shallow } from 'enzyme';
import { LookBack } from '../LookBack';
import { Form, FormGroup } from 'patternfly-react';
import ToolbarDropdown from '../../../components/ToolbarDropdown/ToolbarDropdown';
import { serverConfig } from '../../../config/ServerConfig';

const lookBackOptions = { ...serverConfig.durations, ...{ 0: 'Custom Time Range' } };

describe('LookBack', () => {
  let wrapper, onChangeCustom, setLookback, dates;
  dates = { start: { date: '2019-03-11', time: '10:40' }, end: { date: '2019-03-11', time: '11:40' } };

  beforeEach(() => {
    onChangeCustom = jest.fn();
    setLookback = jest.fn();
    wrapper = shallow(
      <LookBack
        onChangeCustom={onChangeCustom}
        setLookback={setLookback}
        disabled={false}
        lookback={3600}
        dates={dates}
      />
    );
  });

  it('renders LookBack correctly without custom', () => {
    expect(wrapper).toBeDefined();
  });

  it('renders Extra forms when lookback is custom', () => {
    expect(wrapper.find(Form).length).toEqual(0);
    wrapper.setProps({ lookback: 0 });
    expect(wrapper.find(Form).length).toEqual(1);
    expect(wrapper.find(FormGroup).length).toEqual(2);
  });

  it('LookBack has lookBackOptions options', () => {
    expect(wrapper.instance().lookBackOptions).toEqual(lookBackOptions);
  });

  it('disable ToolbarDropwdown if no namespaces', () => {
    expect(wrapper.find(ToolbarDropdown).length).toEqual(1);
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props().disabled
    ).toBeFalsy();
    wrapper.setProps({ disabled: true });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props().disabled
    ).toBeTruthy();
  });

  it('ToolbarDropdown has  lookBackOptions like options', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props().options
    ).toEqual(lookBackOptions);
  });

  it('ToolbarDropdown has 1h by defaut', () => {
    wrapper.setProps({ lookback: '1h' });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props().value
    ).toEqual('1h');
  });

  it('ToolbarDropdown has setLookback like handleSelect', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props().handleSelect
    ).toBe(setLookback);
  });
});
