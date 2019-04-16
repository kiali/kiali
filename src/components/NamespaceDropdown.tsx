import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _ from 'lodash';
import { style } from 'typestyle';
import { Button, Checkbox, ContextSelector } from '@patternfly/react-core';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceItemsSelector, namespaceFilterSelector } from '../store/Selectors';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';
import NamespaceThunkActions from '../actions/NamespaceThunkActions';
import Namespace from '../types/Namespace';
import { HistoryManager, URLParam } from '../app/History';

const namespaceListStyle = style({
  margin: '40px 0 20px 5%'
});

const buttonClearStyle = style({
  float: 'right'
});

interface NamespaceListType {
  disabled: boolean;
  filter: string;
  activeNamespaces: Namespace[];
  items: Namespace[];
  toggleNamespace: (namespace: Namespace) => void;
  setNamespaces: (namespaces: Namespace[]) => void;
  setFilter: (filter: string) => void;
  refresh: () => void;
  clearAll: () => void;
}

interface NamespaceListState {
  isOpen: boolean;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, NamespaceListState> {
  constructor(props: NamespaceListType) {
    super(props);
    this.state = { isOpen: false };
  }

  componentDidMount() {
    this.props.refresh();
    this.syncNamespacesURLParam();
  }

  componentDidUpdate(prevProps: NamespaceListType) {
    if (prevProps.activeNamespaces !== this.props.activeNamespaces) {
      if (this.props.activeNamespaces.length === 0) {
        HistoryManager.deleteParam(URLParam.NAMESPACES);
      } else {
        HistoryManager.setParam(URLParam.NAMESPACES, this.props.activeNamespaces.map(item => item.name).join(','));
      }
    }
  }

  syncNamespacesURLParam = () => {
    const namespaces = (HistoryManager.getParam(URLParam.NAMESPACES) || '').split(',').filter(Boolean);
    if (namespaces.length > 0 && _.difference(namespaces, this.props.activeNamespaces.map(item => item.name))) {
      // We must change the props of namespaces
      const items = namespaces.map(ns => ({ name: ns } as Namespace));
      this.props.setNamespaces(items);
    } else if (namespaces.length === 0 && this.props.activeNamespaces.length !== 0) {
      HistoryManager.setParam(URLParam.NAMESPACES, this.props.activeNamespaces.map(item => item.name).join(','));
    }
  };

  onNamespaceToggled = (isChecked, event) => {
    this.props.toggleNamespace({ name: event.target.name });
  };

  onFilterChange = value => {
    this.props.setFilter(value);
  };

  clearFilter = () => {
    this.props.setFilter('');
  };

  namespaceButtonText() {
    switch (this.props.activeNamespaces.length) {
      case 0:
        return 'Select a namespace';
      case 1:
        return `Namespace : ${this.props.activeNamespaces[0].name}`;
      default:
        return `Namespaces : ${this.props.activeNamespaces.length} namespaces`;
    }
  }

  getNamespaces = () => {
    const activeMap = this.props.activeNamespaces.reduce((map, namespace) => {
      map[namespace.name] = namespace.name;
      return map;
    }, {});

    return (
      <div key={'div_namespace_selector'} className={namespaceListStyle}>
        {this.props.items
          .filter((namespace: Namespace) => namespace.name.includes(this.props.filter))
          .map((namespace: Namespace) => (
            <Checkbox
              key={namespace.name}
              name={namespace.name}
              id={namespace.name}
              isChecked={!!activeMap[namespace.name]}
              onChange={this.onNamespaceToggled}
              label={namespace.name}
              aria-label={namespace.name}
            />
          ))}
      </div>
    );
  };

  onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };

  onButtonSearch = event => {
    this.onFilterChange(this.props.filter);
  };

  render() {
    const { isOpen } = this.state;

    const namespaces = this.props.items.length > 0 ? this.getNamespaces() : [];

    return (
      <div className="namespace-selector">
        <ContextSelector
          toggleText={this.namespaceButtonText()}
          onSearchInputChange={this.onFilterChange}
          isOpen={isOpen}
          searchInputValue={this.props.filter}
          onToggle={this.onToggle}
          onSearchButtonClick={this.onButtonSearch}
          screenReaderLabel="Selected Namespace:"
        >
          <Button
            variant="plain"
            key="clear_all_dropdown_ns"
            aria-label="Action"
            className={buttonClearStyle}
            isDisabled={this.props.activeNamespaces.length === 0}
            onClick={this.props.clearAll}
          >
            Clear all
          </Button>
          {namespaces}
        </ContextSelector>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    items: namespaceItemsSelector(state)!,
    activeNamespaces: activeNamespacesSelector(state),
    filter: namespaceFilterSelector(state)
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    },
    toggleNamespace: (namespace: Namespace) => {
      dispatch(NamespaceActions.toggleActiveNamespace(namespace));
    },
    clearAll: () => {
      dispatch(NamespaceActions.setActiveNamespaces([]));
    },
    setNamespaces: (namespaces: Namespace[]) => {
      dispatch(NamespaceActions.setActiveNamespaces(namespaces));
    },
    setFilter: (filter: string) => {
      dispatch(NamespaceActions.setFilter(filter));
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
