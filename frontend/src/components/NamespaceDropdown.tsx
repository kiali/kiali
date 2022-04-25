import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _ from 'lodash';
import { style } from 'typestyle';
import {
  Button,
  Dropdown,
  DropdownToggle,
  TextInput,
  Tooltip,
  DropdownToggleCheckbox,
  Divider,
  Badge
} from '@patternfly/react-core';
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

type ReduxProps = {
  activeNamespaces: Namespace[];
  filter: string;
  namespaces: Namespace[];
  refresh: () => void;
  setFilter: (filter: string) => void;
  setActiveNamespaces: (namespaces: Namespace[]) => void;
};

type NamespaceDropdownProps = ReduxProps & {
  disabled: boolean;
  clearAll: () => void;
};

type NamespaceDropdownState = {
  isBulkSelectorOpen: boolean;
  isOpen: boolean;
  selectedNamespaces: Namespace[];
};

const checkboxBulkStyle = style({
  marginLeft: '0.5em',
  position: 'relative',
  top: 8
});

const checkboxStyle = style({ marginLeft: '1.0em' });

const checkboxLabelStyle = style({ marginLeft: '0.5em' });

const headerStyle = style({
  margin: '0 0.5em 10px 0.5em',
  width: 300
});

const marginBottom = 20;

const namespaceContainerStyle = style({
  overflow: 'auto'
});

export class NamespaceDropdown extends React.PureComponent<NamespaceDropdownProps, NamespaceDropdownState> {
  constructor(props: NamespaceDropdownProps) {
    super(props);
    this.state = {
      isBulkSelectorOpen: false,
      isOpen: false,
      selectedNamespaces: [...this.props.activeNamespaces]
    };
  }

  componentDidMount() {
    this.props.refresh();
    this.syncNamespacesURLParam();
  }

  // update redux with URL namespaces if set, otherwise update URL with redux
  syncNamespacesURLParam = () => {
    const urlNamespaces = (HistoryManager.getParam(URLParam.NAMESPACES) || '').split(',').filter(Boolean);
    if (
      urlNamespaces.length > 0 &&
      _.difference(
        urlNamespaces,
        this.props.activeNamespaces.map(item => item.name)
      )
    ) {
      // We must change the props of namespaces
      const items = urlNamespaces.map(ns => ({ name: ns } as Namespace));
      this.props.setActiveNamespaces(items);
    } else if (urlNamespaces.length === 0 && this.props.activeNamespaces.length !== 0) {
      HistoryManager.setParam(URLParam.NAMESPACES, this.props.activeNamespaces.map(item => item.name).join(','));
    }
  };

  componentDidUpdate(prevProps: NamespaceDropdownProps) {
    if (prevProps.activeNamespaces !== this.props.activeNamespaces) {
      if (this.props.activeNamespaces.length === 0) {
        HistoryManager.deleteParam(URLParam.NAMESPACES);
      } else {
        HistoryManager.setParam(URLParam.NAMESPACES, this.props.activeNamespaces.map(item => item.name).join(','));
      }
      this.setState({ selectedNamespaces: this.props.activeNamespaces });
    }
  }

  private namespaceButtonText() {
    if (this.state.selectedNamespaces.length === 0) {
      return <span>Select Namespaces</span>;
    }

    return (
      <>
        <span style={{ paddingRight: '0.75em' }}>Namespace:</span>
        {this.state.selectedNamespaces.length === 1 ? (
          <span>{this.state.selectedNamespaces[0].name}</span>
        ) : (
          <Badge>{this.state.selectedNamespaces.length}</Badge>
        )}
      </>
    );
  }

  private getBulkSelector() {
    const selectedNamespaces = this.filteredSelected();
    const numSelected = selectedNamespaces.length;
    const allSelected = numSelected === this.props.namespaces.length;
    const anySelected = numSelected > 0;
    const someChecked = anySelected ? null : false;
    const isChecked = allSelected ? true : someChecked;

    return (
      <div className={checkboxBulkStyle}>
        <DropdownToggleCheckbox
          id="bulk-select-id"
          key="bulk-select-key"
          aria-label="Select all"
          isChecked={isChecked}
          onClick={() => {
            anySelected ? this.onBulkNone() : this.onBulkAll();
          }}
        ></DropdownToggleCheckbox>
        <span className={checkboxLabelStyle}>Select all</span>
      </div>
    );
  }

  private getHeader() {
    const hasFilter = !!this.props.filter;
    return (
      <div className={headerStyle}>
        <span style={{ width: '100%' }}>
          <TextInput
            style={{ width: hasFilter ? 'calc(100% - 44px)' : '100%' }}
            aria-label="filter-namespace"
            type="text"
            name="namespace-filter"
            placeholder="Filter by Name..."
            value={this.props.filter}
            onChange={this.onFilterChange}
          />
          {hasFilter && (
            <Tooltip key="ot_clear_namespace_filter" position="top" content="Clear Filter by Name">
              <Button onClick={this.clearFilter} isInline>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          )}
        </span>
        {this.getBulkSelector()}
        <Divider style={{ paddingTop: '5px' }} />
      </div>
    );
  }

  private getBody() {
    if (this.props.namespaces.length > 0) {
      const selectedMap = this.state.selectedNamespaces.reduce((map, namespace) => {
        map[namespace.name] = namespace.name;
        return map;
      }, {});
      const namespaces = this.filtered().map((namespace: Namespace) => (
        <div
          className={checkboxStyle}
          id={`namespace-list-item[${namespace.name}]`}
          key={`namespace-list-item[${namespace.name}]`}
        >
          <input
            type="checkbox"
            value={namespace.name}
            checked={!!selectedMap[namespace.name]}
            onChange={this.onNamespaceToggled}
          />
          <span className={checkboxLabelStyle}>{namespace.name}</span>
        </div>
      ));

      return (
        <>
          <BoundingClientAwareComponent
            className={namespaceContainerStyle}
            maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
          >
            {namespaces}
          </BoundingClientAwareComponent>
        </>
      );
    }
    return <div>No namespaces found</div>;
  }

  render() {
    return (
      <TourStopContainer info={GraphTourStops.Namespaces}>
        <Dropdown
          toggle={
            <DropdownToggle
              data-test="namespace-dropdown"
              id={'namespace-selector'}
              onToggle={this.onToggle}
              isDisabled={this.props.disabled}
            >
              {this.namespaceButtonText()}
            </DropdownToggle>
          }
          isOpen={this.state.isOpen}
        >
          {this.getHeader()}
          {this.getBody()}
        </Dropdown>
      </TourStopContainer>
    );
  }

  private onToggle = isOpen => {
    if (isOpen) {
      this.props.refresh();
    } else {
      this.props.setActiveNamespaces(this.state.selectedNamespaces);
      this.clearFilter();
    }
    this.setState({
      isOpen
    });
  };

  private onBulkAll = () => {
    const union = Array.from(new Set([...this.state.selectedNamespaces, ...this.filtered()]));
    this.setState({ selectedNamespaces: union });
  };

  private onBulkNone = () => {
    const filtered = this.filtered();
    const remaining = this.state.selectedNamespaces.filter(s => filtered.findIndex(f => f.name === s.name) < 0);
    this.setState({ selectedNamespaces: remaining });
  };

  onNamespaceToggled = event => {
    const namespace = event.target.value;
    const selectedNamespaces = !!this.state.selectedNamespaces.find(n => n.name === namespace)
      ? this.state.selectedNamespaces.filter(n => n.name !== namespace)
      : this.state.selectedNamespaces.concat([{ name: event.target.value } as Namespace]);
    this.setState({ selectedNamespaces: selectedNamespaces });
  };

  private onFilterChange = (value: string) => {
    this.props.setFilter(value);
  };

  private clearFilter = () => {
    this.props.setFilter('');
  };

  private filtered = (): Namespace[] => {
    return this.props.namespaces.filter(ns => ns.name.includes(this.props.filter));
  };

  private filteredSelected = (): Namespace[] => {
    const filtered = this.filtered();
    return this.state.selectedNamespaces.filter(s => filtered.findIndex(f => f.name === s.name) >= 0);
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    namespaces: namespaceItemsSelector(state)!,
    activeNamespaces: activeNamespacesSelector(state),
    filter: namespaceFilterSelector(state)
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    },
    clearAll: () => {
      dispatch(NamespaceActions.setActiveNamespaces([]));
    },
    setActiveNamespaces: (namespaces: Namespace[]) => {
      dispatch(NamespaceActions.setActiveNamespaces(namespaces));
    },
    setFilter: (filter: string) => {
      dispatch(NamespaceActions.setFilter(filter));
    }
  };
};

const NamespaceDropdownContainer = connect(mapStateToProps, mapDispatchToProps)(NamespaceDropdown);
export default NamespaceDropdownContainer;
