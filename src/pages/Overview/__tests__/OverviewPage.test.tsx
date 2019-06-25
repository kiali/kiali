import * as React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { shallowToJson } from 'enzyme-to-json';

import { mount, shallow, ReactWrapper } from 'enzyme';
import { OverviewPage } from '../OverviewPage';
import OverviewPageContainer from '../OverviewPage';
import { FilterSelected } from '../../../components/Filters/StatefulFilters';
import * as API from '../../../services/Api';
import { AppHealth, NamespaceAppHealth, HEALTHY, FAILURE, DEGRADED } from '../../../types/Health';
import { store } from '../../../store/ConfigStore';
import { MTLSStatuses } from '../../../types/TLSStatus';

(window as any).SVGPathElement = a => a;

const mockAPIToPromise = (func: keyof typeof API, obj: any, encapsData: boolean): Promise<void> => {
  return new Promise((resolve, reject) => {
    jest.spyOn(API, func).mockImplementation(() => {
      return new Promise(r => {
        if (encapsData) {
          r({ data: obj });
        } else {
          r(obj);
        }
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

const mockNamespaces = (names: string[]): Promise<void> => {
  return mockAPIToPromise('getNamespaces', names.map(n => ({ name: n })), true);
};

const mockNamespaceHealth = (obj: NamespaceAppHealth): Promise<void> => {
  return mockAPIToPromise('getNamespaceAppHealth', obj, false);
};

let mounted: ReactWrapper<any, any> | null;

const mountPage = () => {
  mounted = mount(
    <Provider store={store}>
      <Router>
        <OverviewPageContainer />
      </Router>
    </Provider>
  );
};

describe('Overview page', () => {
  beforeEach(() => {
    mounted = null;
  });
  afterEach(() => {
    if (mounted) {
      mounted.unmount();
    }
  });

  it('renders initial layout', () => {
    const wrapper = shallow(<OverviewPage meshStatus={MTLSStatuses.NOT_ENABLED} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders all without filters', done => {
    FilterSelected.setSelected([]);
    Promise.all([
      mockNamespaces(['a', 'b', 'c']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth,
        app2: {
          getGlobalStatus: () => FAILURE
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      // All 3 namespaces rendered
      expect(mounted!.find('Card')).toHaveLength(3);
      done();
    });
    mountPage();
  });

  it('filters failures match', done => {
    FilterSelected.setSelected([
      {
        category: 'Health',
        value: 'Failure'
      }
    ]);
    Promise.all([
      mockNamespaces(['a']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => DEGRADED
        } as AppHealth,
        app2: {
          getGlobalStatus: () => FAILURE
        } as AppHealth,
        app3: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(1);
      done();
    });
    mountPage();
  });

  it('filters failures no match', done => {
    FilterSelected.setSelected([
      {
        category: 'Health',
        value: 'Failure'
      }
    ]);
    Promise.all([
      mockNamespaces(['a']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => DEGRADED
        } as AppHealth,
        app2: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth,
        app3: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('multi-filters health match', done => {
    FilterSelected.setSelected([
      {
        category: 'Health',
        value: 'Failure'
      },
      {
        category: 'Health',
        value: 'Degraded'
      }
    ]);
    Promise.all([
      mockNamespaces(['a']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => DEGRADED
        } as AppHealth,
        app2: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(1);
      done();
    });
    mountPage();
  });

  it('multi-filters health no match', done => {
    FilterSelected.setSelected([
      {
        category: 'Health',
        value: 'Failure'
      },
      {
        category: 'Health',
        value: 'Degraded'
      }
    ]);
    Promise.all([
      mockNamespaces(['a']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth,
        app2: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name match', done => {
    FilterSelected.setSelected([
      {
        category: 'Name',
        value: 'bc'
      }
    ]);
    Promise.all([
      mockNamespaces(['abc', 'bce', 'ced']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(2);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name no match', done => {
    FilterSelected.setSelected([
      {
        category: 'Name',
        value: 'yz'
      }
    ]);
    mockNamespaces(['abc', 'bce', 'ced']).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name and health match', done => {
    FilterSelected.setSelected([
      {
        category: 'Name',
        value: 'bc'
      },
      {
        category: 'Health',
        value: 'Healthy'
      }
    ]);
    Promise.all([
      mockNamespaces(['abc', 'bce', 'ced']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => HEALTHY
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(2);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name and health no match', done => {
    FilterSelected.setSelected([
      {
        category: 'Name',
        value: 'bc'
      },
      {
        category: 'Health',
        value: 'Healthy'
      }
    ]);
    Promise.all([
      mockNamespaces(['abc', 'bce', 'ced']),
      mockNamespaceHealth({
        app1: {
          getGlobalStatus: () => DEGRADED
        } as AppHealth
      })
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });
});
