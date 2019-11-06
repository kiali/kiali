import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _ from 'lodash';
import { style } from 'typestyle';
import { Button, ButtonVariant, Dropdown, DropdownToggle, TextInput, Tooltip } from '@patternfly/react-core';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceFilterSelector, namespaceItemsSelector } from '../store/Selectors';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';
import NamespaceThunkActions from '../actions/NamespaceThunkActions';
import Namespace from '../types/Namespace';
import { HistoryManager, URLParam } from '../app/History';
import {
  BoundingClientAwareComponent,
  PropertyType
} from './BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import TourStopContainer from './Tour/TourStop';
import { GraphTourStops } from '../pages/Graph/GraphHelpTour';

interface ReduxProps {
  activeNamespaces: Namespace[];
  filter: string;
  items: Namespace[];
  refresh: () => void;
  toggleNamespace: (namespace: Namespace) => void;
  setFilter: (filter: string) => void;
  setNamespaces: (namespaces: Namespace[]) => void;
}

interface NamespaceDropdownProps extends ReduxProps {
  disabled: boolean;
  clearAll: () => void;
}

const namespaceLabelStyle = style({
  fontWeight: 400
});

const namespaceValueStyle = style({
  fontWeight: 400
});

const popoverMarginBottom = 20;

const namespaceContainerStyle = style({
  overflow: 'auto'
});

const clearAllButtonStyle = style({
  margin: '0, 1em, 0, 0'
});

interface ReduxProps {
  activeNamespaces: Namespace[];
  filter: string;
  items: Namespace[];
  refresh: () => void;
  toggleNamespace: (namespace: Namespace) => void;
  setFilter: (filter: string) => void;
  setNamespaces: (namespaces: Namespace[]) => void;
}

interface NamespaceDropdownProps extends ReduxProps {
  disabled: boolean;
  clearAll: () => void;
}

interface NamespaceDropdownState {
  isOpen: boolean;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceDropdownProps, NamespaceDropdownState> {
  constructor(props: NamespaceDropdownProps) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  componentDidMount() {
    this.props.refresh();
    this.syncNamespacesURLParam();
  }

  componentDidUpdate(prevProps: NamespaceDropdownProps) {
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

  onNamespaceToggled = (a: any) => {
    this.props.toggleNamespace({ name: a.target.value });
  };

  onFilterChange = (value: string) => {
    this.props.setFilter(value);
  };

  clearFilter = () => {
    this.props.setFilter('');
  };

  namespaceButtonText() {
    if (this.props.activeNamespaces.length === 0) {
      return <span className={namespaceValueStyle}>Select a namespace</span>;
    } else if (this.props.activeNamespaces.length === 1) {
      return (
        <>
          <span className={namespaceLabelStyle}>Namespace:</span>
          <span>&nbsp;</span>
          <span className={namespaceValueStyle}>{this.props.activeNamespaces[0].name}</span>
        </>
      );
    } else {
      return (
        <>
          <span className={namespaceLabelStyle}>Namespaces:</span>
          <span>&nbsp;</span>
          <span className={namespaceValueStyle}>{`${this.props.activeNamespaces.length} namespaces`}</span>
        </>
      );
    }
  }

  private onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };

  private getHeaderContent() {
    const headerWidth = 300;
    const closeButtonWidth = this.props.filter ? 40 : 0;
    const marginWidth = 10;
    const inputWidth = headerWidth - closeButtonWidth - 2 * marginWidth;
    return (
      <>
        <div style={{ float: 'left', width: headerWidth }}>
          <TextInput
            style={{ marginLeft: marginWidth, width: inputWidth }}
            aria-label="filter-namespace"
            type="text"
            name="namespace-filter"
            placeholder="Filter by Name..."
            value={this.props.filter}
            onChange={this.onFilterChange}
          />
          {this.props.filter && (
            <Tooltip key="ot_clear_namespace_filter" position="top" content="Clear Filter by Name">
              <Button onClick={this.clearFilter}>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          )}
        </div>
        <div className="text-right">
          <Button
            variant={ButtonVariant.link}
            disabled={this.props.activeNamespaces.length === -1}
            onClick={this.props.clearAll}
            className={clearAllButtonStyle}
            aria-label="clear-all"
          >
            Clear all
          </Button>
        </div>
      </>
    );
  }

  private getPopoverContent() {
    if (this.props.items.length > 0) {
      const activeMap = this.props.activeNamespaces.reduce((map, namespace) => {
        map[namespace.name] = namespace.name;
        return map;
      }, {});
      const checkboxLabelStyle = style({ marginLeft: '0.5em' });
      const namespaces = this.props.items
        .filter((namespace: Namespace) => namespace.name.includes(this.props.filter))
        .map((namespace: Namespace) => (
          <div
            style={{ marginLeft: '0.5em' }}
            id={`namespace-list-item[${namespace.name}]`}
            key={`namespace-list-item[${namespace.name}]`}
          >
            <label>
              <input
                type="checkbox"
                value={namespace.name}
                checked={!!activeMap[namespace.name]}
                onChange={this.onNamespaceToggled}
              />
              <span className={checkboxLabelStyle}>{namespace.name}</span>
            </label>
          </div>
        ));

      return (
        <>
          <BoundingClientAwareComponent
            className={namespaceContainerStyle}
            maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: popoverMarginBottom }}
          >
            {namespaces}
          </BoundingClientAwareComponent>
        </>
      );
    }
    return <div>No namespaces found or they haven't loaded yet</div>;
  }

  render() {
    const { isOpen } = this.state;
    return (
      <TourStopContainer info={GraphTourStops.Namespaces}>
        <Dropdown
          toggle={<DropdownToggle onToggle={this.onToggle}>{this.namespaceButtonText()}</DropdownToggle>}
          isOpen={isOpen}
        >
          {this.getHeaderContent()}
          {this.getPopoverContent()}
        </Dropdown>
      </TourStopContainer>
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
