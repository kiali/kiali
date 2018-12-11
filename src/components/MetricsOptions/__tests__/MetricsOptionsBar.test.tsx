import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { Provider } from 'react-redux';
import MetricsOptionsBar from '../MetricsOptionsBar';
import { store } from '../../../store/ConfigStore';

const optionsChanged = jest.fn();

describe('MetricsOptionsBar', () => {
  it('renders initial layout', () => {
    const wrapper = shallow(
      <Provider store={store}>
        <MetricsOptionsBar
          onOptionsChanged={jest.fn()}
          onRefresh={jest.fn()}
          onLabelsFiltersChanged={jest.fn()}
          direction={'inbound'}
          labelValues={new Map()}
          grafanaLink={'http://grafana-istio-system.127.0.0.1.nip.io/d/UbsSZTDik/istio-workload-dashboard'}
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
          onLabelsFiltersChanged={jest.fn()}
          direction={'inbound'}
          labelValues={new Map()}
          grafanaLink={''}
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

  it('Has a Grafana link', () => {
    let wrapper = mount(
      <Provider store={store}>
        <MetricsOptionsBar
          onOptionsChanged={jest.fn()}
          onRefresh={jest.fn()}
          onLabelsFiltersChanged={jest.fn()}
          direction={'inbound'}
          labelValues={new Map()}
          grafanaLink={'http://grafana-istio-system.127.0.0.1.nip.io/d/UbsSZTDik/istio-workload-dashboard'}
        />
      </Provider>
    );
    expect(wrapper.find('#grafana_link')).toHaveLength(1);
  });
});
