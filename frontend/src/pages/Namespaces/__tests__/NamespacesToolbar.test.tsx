import * as React from 'react';
import { mount } from 'enzyme';
import { NamespacesToolbar } from '../NamespacesToolbar';
import { HistoryManager } from '../../../app/History';
import * as Sorts from '../Sorts';

let mockUrlParams: Record<string, string> = {};

// Some imports use path aliases (app/History), others are relative. Mock both to keep a single URL-param store.
jest.mock('app/History', () => ({
  HistoryManager: {
    deleteParam: jest.fn(),
    getDuration: jest.fn(),
    getNumericParam: jest.fn(),
    setParam: jest.fn((name: string, value: string) => {
      mockUrlParams[name] = value;
    }),
    getParam: jest.fn((name: string) => mockUrlParams[name])
  },
  URLParam: {
    SORT: 'sort',
    DIRECTION: 'direction',
    DURATION: 'duration',
    REFRESH_INTERVAL: 'refresh'
  },
  location: {
    getPathname: jest.fn(() => ''),
    getSearch: jest.fn(() => '')
  },
  webRoot: '/'
}));

jest.mock('../../../app/History', () => ({
  HistoryManager: {
    deleteParam: jest.fn(),
    getDuration: jest.fn(),
    getNumericParam: jest.fn(),
    setParam: jest.fn((name: string, value: string) => {
      mockUrlParams[name] = value;
    }),
    getParam: jest.fn((name: string) => mockUrlParams[name])
  },
  URLParam: {
    SORT: 'sort',
    DIRECTION: 'direction',
    DURATION: 'duration',
    REFRESH_INTERVAL: 'refresh'
  },
  location: {
    getPathname: jest.fn(() => ''),
    getSearch: jest.fn(() => '')
  },
  webRoot: '/'
}));

jest.mock('../../../components/Filters/StatefulFilters', () => ({
  StatefulFilters: () => <div data-test="StatefulFilters" />
}));

jest.mock('../../../components/Time/TimeDurationComponent', () => ({
  TimeDurationComponent: () => <div data-test="TimeDurationComponent" />
}));

describe('NamespacesToolbar', () => {
  const defaultProps = {
    duration: 600,
    language: 'en',
    onChange: jest.fn(),
    onRefresh: jest.fn(),
    refreshInterval: 15000,
    setRefreshInterval: jest.fn(),
    sort: jest.fn(),
    statefulFilterRef: { current: null } as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUrlParams = {};
  });

  const Wrapped = (NamespacesToolbar as any).WrappedComponent;
  const getInstance = (wrapper: any): any => wrapper.instance();

  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);
      expect(wrapper.exists()).toBeTruthy();
    });

    it('renders StatefulFilters component', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);
      expect(wrapper.find('[data-test="StatefulFilters"]').exists()).toBeTruthy();
    });

    it('renders TimeDurationComponent', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);
      expect(wrapper.find('[data-test="TimeDurationComponent"]').exists()).toBeTruthy();
    });
  });

  describe('Component lifecycle', () => {
    it('initializes state correctly', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);
      const instance = getInstance(wrapper);

      expect(typeof instance.state.isSortAscending).toBe('boolean');
      expect(instance.state.sortField).toBeDefined();
    });

    it('syncs state with URL params on update', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);

      const instance = getInstance(wrapper);
      expect(() => instance.componentDidUpdate()).not.toThrow();
      expect(instance.state.sortField).toBeDefined();
    });
  });

  describe('Sort field updates', () => {
    it('updates sort field when changed', () => {
      const sortSpy = jest.fn();
      const wrapper = mount(<Wrapped {...defaultProps} sort={sortSpy} />);

      const instance = getInstance(wrapper);
      jest.spyOn(instance, 'componentDidUpdate').mockImplementation(() => {});
      const newSortField = Sorts.sortFields[1];

      instance.updateSortField(newSortField);
      wrapper.update();

      expect(sortSpy).toHaveBeenCalledWith(newSortField, true);
      expect(HistoryManager.setParam).toHaveBeenCalled();
      expect(instance.state.sortField.param).toBe(newSortField.param);
    });

    it('changes sort field by value', () => {
      const sortSpy = jest.fn();
      const wrapper = mount(<Wrapped {...defaultProps} sort={sortSpy} />);

      const instance = getInstance(wrapper);
      const targetSortField = Sorts.sortFields.find(sf => sf.id === 'health');

      if (targetSortField) {
        instance.changeSortField(targetSortField.id);

        expect(sortSpy).toHaveBeenCalledWith(targetSortField, expect.any(Boolean));
        expect(HistoryManager.setParam).toHaveBeenCalled();
      }
    });
  });

  describe('Sort direction updates', () => {
    it('toggles sort direction', () => {
      const sortSpy = jest.fn();
      const wrapper = mount(<Wrapped {...defaultProps} sort={sortSpy} />);

      const instance = getInstance(wrapper);
      jest.spyOn(instance, 'componentDidUpdate').mockImplementation(() => {});
      const initialDirection = instance.state.isSortAscending;

      instance.updateSortDirection();
      wrapper.update();

      expect(sortSpy).toHaveBeenCalledWith(instance.state.sortField, !initialDirection);
      expect(HistoryManager.setParam).toHaveBeenCalled();
      expect(instance.state.isSortAscending).toBe(!initialDirection);
    });
  });

  describe('Parameters sync check', () => {
    it('detects when params are synced', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);

      const instance = getInstance(wrapper);
      const currentSortField = instance.state.sortField;
      const currentDirection = instance.state.isSortAscending;

      const isSynced = instance.paramsAreSynced(currentSortField, currentDirection);
      expect(isSynced).toBe(true);
    });

    it('detects when params are not synced', () => {
      const wrapper = mount(<Wrapped {...defaultProps} />);

      const instance = getInstance(wrapper);
      const currentSortField = instance.state.sortField;
      const oppositeDirection = !instance.state.isSortAscending;

      const isSynced = instance.paramsAreSynced(currentSortField, oppositeDirection);
      expect(isSynced).toBe(false);
    });
  });
});
