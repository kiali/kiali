import * as React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { shallowToJson } from 'enzyme-to-json';
import { mount, shallow, ReactWrapper } from 'enzyme';
import { OverviewPage } from '../OverviewPage';
import OverviewPageContainer from '../OverviewPage';
import { FilterSelected } from '../../../components/Filters/StatefulFilters';
import * as API from '../../../services/Api';
import { AppHealth, HEALTHY, FAILURE, DEGRADED, NamespaceAppsHealth } from '../../../types/Health';
import { store } from '../../../store/ConfigStore';
import { MTLSStatuses } from '../../../types/TLSStatus';
import { FilterType, ActiveFiltersInfo } from 'types/Filters';
import { healthFilter } from 'components/Filters/CommonFilters';
import { nameFilter } from '../Filters';
import { DEFAULT_LABEL_OPERATION } from '../../../types/Filters';
import Namespace from 'types/Namespace';

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
        }, 2);
      });
    });
  });
};

const mockNamespaces = (namespaces: Namespace[]): Promise<void> => {
  return mockAPIToPromise('getNamespaces', namespaces, true);
};

const mockNamespaceHealth = (obj: NamespaceAppsHealth): Promise<void> => {
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

const genActiveFilters = (filter: FilterType, values: string[]): ActiveFiltersInfo => {
  return {
    filters: values.map(v => {
      return {
        category: filter.category,
        value: v
      };
    }),
    op: 'or'
  };
};

const concat = (f1: ActiveFiltersInfo, f2: ActiveFiltersInfo): ActiveFiltersInfo => {
  return {
    filters: f1.filters.concat(f2.filters),
    op: f1.op
  };
};

describe('Overview page', () => {
  beforeEach(() => {
    mounted = null;

    // Ignore other calls
    mockAPIToPromise('getNamespaceMetrics', null, false);
    mockAPIToPromise('getNamespaceTls', null, false);
    mockAPIToPromise('getConfigValidations', null, false);
    mockAPIToPromise('getAllIstioConfigs', null, false);
    mockAPIToPromise('getIstioPermissions', {}, false);
  });

  afterEach(() => {
    jest.clearAllMocks();

    if (mounted) {
      mounted.unmount();
    }
  });

  it('renders initial layout', () => {
    const wrapper = shallow(
      <OverviewPage
        meshStatus={MTLSStatuses.NOT_ENABLED}
        navCollapse={false}
        duration={600}
        refreshInterval={10000}
        kiosk={''}
        minTLS={''}
        istioAPIEnabled={false}
        isMaistra={false}
      />
    );
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders all without filters', done => {
    FilterSelected.setSelected({ filters: [], op: DEFAULT_LABEL_OPERATION });
    Promise.all([
      mockNamespaces([
        { name: 'a', cluster: 'cluster1' },
        { name: 'b', cluster: 'cluster1' },
        { name: 'c', cluster: 'cluster1' }
      ]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        },
        {
          name: 'app1',
          namespace: 'b',
          cluster: 'cluster2',
          health: {
            getGlobalStatus: () => FAILURE
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      // All 3 namespaces rendered
      expect(mounted!.find('Card')).toHaveLength(3);
      done();
    });
    mountPage();
  });

  it('filters failures match', done => {
    FilterSelected.setSelected(genActiveFilters(healthFilter, ['Failure']));
    Promise.all([
      mockNamespaces([{ name: 'a', cluster: 'cluster1' }]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => DEGRADED
          } as AppHealth
        },
        {
          name: 'app2',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => FAILURE
          } as AppHealth
        },
        {
          name: 'app3',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(1);
      done();
    });
    mountPage();
  });

  it('filters failures no match', done => {
    FilterSelected.setSelected(genActiveFilters(healthFilter, ['Failure']));
    Promise.all([
      mockNamespaces([{ name: 'a', cluster: 'cluster1' }]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => DEGRADED
          } as AppHealth
        },
        {
          name: 'app2',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        },
        {
          name: 'app3',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('multi-filters health match', done => {
    FilterSelected.setSelected(genActiveFilters(healthFilter, ['Failure', 'Degraded']));
    Promise.all([
      mockNamespaces([{ name: 'a', cluster: 'cluster1' }]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => DEGRADED
          } as AppHealth
        },
        {
          name: 'app2',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(1);
      done();
    });
    mountPage();
  });

  it('multi-filters health no match', done => {
    FilterSelected.setSelected(genActiveFilters(healthFilter, ['Failure', 'Degraded']));
    Promise.all([
      mockNamespaces([{ name: 'a', cluster: 'cluster1' }]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        },
        {
          name: 'app2',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name match', done => {
    FilterSelected.setSelected(genActiveFilters(nameFilter, ['bc']));
    Promise.all([
      mockNamespaces([
        { name: 'abc', cluster: 'cluster1' },
        { name: 'bce', cluster: 'cluster1' },
        { name: 'ced', cluster: 'cluster1' }
      ]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(2);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name no match', done => {
    FilterSelected.setSelected(genActiveFilters(nameFilter, ['yz']));
    mockNamespaces([
      { name: 'abc', cluster: 'cluster1' },
      { name: 'bce', cluster: 'cluster1' },
      { name: 'ced', cluster: 'cluster1' }
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name and health match', done => {
    FilterSelected.setSelected(
      concat(genActiveFilters(nameFilter, ['bc']), genActiveFilters(healthFilter, ['Healthy']))
    );
    Promise.all([
      mockNamespaces([
        { name: 'abc', cluster: 'cluster1' },
        { name: 'bce', cluster: 'cluster1' },
        { name: 'ced', cluster: 'cluster1' }
      ]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => HEALTHY
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(2);
      done();
    });
    mountPage();
  });

  it('filters namespaces info name and health no match', done => {
    FilterSelected.setSelected(
      concat(genActiveFilters(nameFilter, ['bc']), genActiveFilters(healthFilter, ['Healthy']))
    );
    Promise.all([
      mockNamespaces([
        { name: 'abc', cluster: 'cluster1' },
        { name: 'bce', cluster: 'cluster1' },
        { name: 'ced', cluster: 'cluster1' }
      ]),
      mockNamespaceHealth([
        {
          name: 'app1',
          namespace: 'a',
          cluster: 'cluster1',
          health: {
            getGlobalStatus: () => DEGRADED
          } as AppHealth
        }
      ])
    ]).then(() => {
      mounted!.update();
      expect(mounted!.find('Card')).toHaveLength(0);
      done();
    });
    mountPage();
  });
});
