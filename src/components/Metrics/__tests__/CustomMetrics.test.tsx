import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { Provider } from 'react-redux';
import { MemoryRouter, Route } from 'react-router';
import { DashboardModel } from 'k-charted-react';

import CustomMetrics from '../CustomMetrics';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';

(window as any).SVGPathElement = a => a;
let mounted: ReactWrapper<any, any> | null;

const mockAPIToPromise = (func: keyof typeof API, obj: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    jest.spyOn(API, func).mockImplementation(() => {
      return new Promise(r => {
        r({ data: obj });
        setTimeout(() => {
          try {
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 1);
      });
    });
  });
};

const mockCustomDashboard = (dashboard: DashboardModel): Promise<void> => {
  return mockAPIToPromise('getCustomDashboard', dashboard);
};

describe('Custom metrics', () => {
  beforeEach(() => {
    mounted = null;
  });
  afterEach(() => {
    if (mounted) {
      mounted.unmount();
    }
  });

  it('mounts and loads empty metrics', done => {
    mockCustomDashboard({ title: 'foo', aggregations: [], charts: [] })
      .then(() => {
        mounted!.update();
        expect(mounted!.find('.card-pf')).toHaveLength(1);
        mounted!.find('.card-pf').forEach(pfCard => expect(pfCard.children().length === 0));
        done();
      })
      .catch(err => done.fail(err));
    mounted = mount(
      <Provider store={store}>
        <MemoryRouter>
          <Route render={props => <CustomMetrics {...props} namespace="ns" app="test" template="vertx" />} />
        </MemoryRouter>
      </Provider>
    );
  });
});
