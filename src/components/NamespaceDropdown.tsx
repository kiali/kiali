import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _ from 'lodash';
import { style } from 'typestyle';
import { Button, TextInput, Select, InputGroup } from '@patternfly/react-core';
import { CloseIcon } from '@patternfly/react-icons';
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

const namespaceLabelStyle = style({
  margin: '0 0 0 10px'
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
  isExpanded: boolean;
  namespaces: object;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, NamespaceListState> {
  constructor(props: NamespaceListType) {
    super(props);
    this.state = { isExpanded: false, namespaces: [] };
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

  onNamespaceToggled = (event: any) => {
    this.props.toggleNamespace({ name: event.target.value });
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
    if (this.props.items.length > 0) {
      const activeMap = this.props.activeNamespaces.reduce((map, namespace) => {
        map[namespace.name] = namespace.name;
        return map;
      }, {});

      return (
        <div key={'div_namespace_selector'} className={namespaceListStyle}>
          {this.props.items
            .filter((namespace: Namespace) => namespace.name.includes(this.props.filter))
            .map((namespace: Namespace) => (
              <div id={`namespace-list-item[${namespace.name}]`} key={`namespace-list-item[${namespace.name}]`}>
                <label>
                  <input
                    type="checkbox"
                    value={namespace.name}
                    checked={!!activeMap[namespace.name]}
                    onChange={this.onNamespaceToggled}
                  />
                  <span className={namespaceLabelStyle}>{namespace.name}</span>
                </label>
              </div>
            ))}
        </div>
      );
    } else {
      return <>No namespaces found or they haven't loaded yet</>;
    }
  };

  onToggle = isExpanded => {
    this.setState({
      isExpanded
    });
  };

  onClearAll = () => {
    this.clearFilter();
    this.props.clearAll();
  };

  render() {
    const { isExpanded } = this.state;

    return (
      <div className="namespace-selector">
        <Select
          onToggle={this.onToggle}
          onSelect={this.syncNamespacesURLParam}
          isExpanded={isExpanded}
          aria-label="Select Input"
          placeholderText={this.namespaceButtonText()}
          variant="single"
        >
          <div className="filter-selector-namespace">
            Filter by :
            <InputGroup>
              <TextInput
                value={this.props.filter}
                type="text"
                onChange={this.onFilterChange}
                aria-label="text input filter"
              />
              {this.props.filter !== '' && (
                <Button
                  variant={'tertiary'}
                  aria-label="search button for search namespaces"
                  onClick={() => this.clearFilter()}
                >
                  <CloseIcon />
                </Button>
              )}
            </InputGroup>
          </div>
          <Button
            variant="plain"
            key="clear_all_dropdown_ns"
            aria-label="Action"
            className={buttonClearStyle}
            isDisabled={this.props.activeNamespaces.length === 0}
            onClick={this.onClearAll}
          >
            Clear all
          </Button>
          {this.getNamespaces()}
        </Select>
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
