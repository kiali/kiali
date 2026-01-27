import * as React from 'react';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { NamespacesToolbar } from '../NamespacesToolbar';
import { store } from '../../../store/ConfigStore';
import { HistoryManager } from '../../../app/History';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import * as Sorts from '../Sorts';

jest.mock('../../../app/History', () => ({
  HistoryManager: {
    setParam: jest.fn(),
    getParam: jest.fn()
  },
  URLParam: {
    SORT: 'sort',
    DIRECTION: 'direction'
  }
}));

jest.mock('../../../components/FilterList/FilterHelper', () => ({
  isCurrentSortAscending: jest.fn(() => true),
  currentSortField: jest.fn(() => ({
    id: 'namespace',
    title: 'Name',
    param: 'ns',
    compare: jest.fn(),
    isNumeric: false
  }))
}));

describe('NamespacesToolbar', () => {
  const defaultProps = {
    onChange: jest.fn(),
    onRefresh: jest.fn(),
    sort: jest.fn(),
    statefulFilterRef: { current: null } as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );
      expect(wrapper.exists()).toBeTruthy();
    });

    it('renders StatefulFilters component', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );
      expect(wrapper.find('StatefulFilters').exists()).toBeTruthy();
    });

    it('renders TimeDurationComponent', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );
      expect(wrapper.find('TimeDurationComponent').exists()).toBeTruthy();
    });
  });

  describe('Component lifecycle', () => {
    it('initializes state correctly', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );
      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;

      expect(instance.state.isSortAscending).toBe(true);
      expect(instance.state.sortField).toBeDefined();
    });

    it('syncs state with URL params on update', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );

      const newSortField = Sorts.sortFields[1];
      (FilterHelper.currentSortField as jest.Mock).mockReturnValue(newSortField);
      (FilterHelper.isCurrentSortAscending as jest.Mock).mockReturnValue(false);

      wrapper.setProps({});
      wrapper.update();

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
      expect(instance.state.sortField.title).toBe(newSortField.title);
      expect(instance.state.isSortAscending).toBe(false);
    });
  });

  describe('Sort field updates', () => {
    it('updates sort field when changed', () => {
      const sortSpy = jest.fn();
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} sort={sortSpy} />
        </Provider>
      );

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
      const newSortField = Sorts.sortFields[1];

      instance.updateSortField(newSortField);

      expect(sortSpy).toHaveBeenCalledWith(newSortField, true);
      expect(HistoryManager.setParam).toHaveBeenCalled();
      expect(instance.state.sortField).toBe(newSortField);
    });

    it('changes sort field by value', () => {
      const sortSpy = jest.fn();
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} sort={sortSpy} />
        </Provider>
      );

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
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
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} sort={sortSpy} />
        </Provider>
      );

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
      const initialDirection = instance.state.isSortAscending;

      instance.updateSortDirection();

      expect(sortSpy).toHaveBeenCalledWith(instance.state.sortField, !initialDirection);
      expect(HistoryManager.setParam).toHaveBeenCalled();
      expect(instance.state.isSortAscending).toBe(!initialDirection);
    });
  });

  describe('Parameters sync check', () => {
    it('detects when params are synced', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
      const currentSortField = instance.state.sortField;
      const currentDirection = instance.state.isSortAscending;

      const isSynced = instance.paramsAreSynced(currentSortField, currentDirection);
      expect(isSynced).toBe(true);
    });

    it('detects when params are not synced', () => {
      const wrapper = mount(
        <Provider store={store}>
          <NamespacesToolbar {...defaultProps} />
        </Provider>
      );

      const instance = wrapper.find('NamespacesToolbarComponent').instance() as any;
      const currentSortField = instance.state.sortField;
      const oppositeDirection = !instance.state.isSortAscending;

      const isSynced = instance.paramsAreSynced(currentSortField, oppositeDirection);
      expect(isSynced).toBe(false);
    });
  });
});
