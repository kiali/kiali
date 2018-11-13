import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { Provider } from 'react-redux';
import MetricsOptionsBar from '../MetricsOptionsBar';
import { MetricsDirection } from '../../../types/Metrics';
import { store } from '../../../store/ConfigStore';

const optionsChanged = jest.fn();

describe('MetricsOptionsBar', () => {
  it('renders initial layout', () => {
    const wrapper = shallow(
      <Provider store={store}>
        <MetricsOptionsBar
          onOptionsChanged={jest.fn()}
          onRefresh={jest.fn()}
          onReporterChanged={jest.fn()}
          onLabelsFiltersChanged={jest.fn()}
          metricReporter={'destination'}
          direction={MetricsDirection.INBOUND}
          labelValues={new Map()}
        />
      </Provider>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('changes trigger parent callback', () => {
    const wrapper = mount(
      <Provider store={store}>
        <MetricsOptionsBar
          onOptionsChanged={optionsChanged}
          onRefresh={jest.fn()}
          onReporterChanged={jest.fn()}
          onLabelsFiltersChanged={jest.fn()}
          metricReporter={'destination'}
          direction={MetricsDirection.INBOUND}
          labelValues={new Map()}
        />
      </Provider>
    );
    expect(optionsChanged).toHaveBeenCalledTimes(1);

    const elt = wrapper
      .find('#metrics_filter_interval_duration')
      .find('SafeAnchor')
      .at(1);
    elt.simulate('click');
    wrapper.setProps({}); // Force re-render
    expect(optionsChanged).toHaveBeenCalledTimes(2);
  });
});
