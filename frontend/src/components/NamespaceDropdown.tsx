import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import _ from 'lodash';
import { kialiStyle } from 'styles/StyleUtils';
import {
  Button,
  TextInput,
  Tooltip,
  Divider,
  Badge,
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList,
  Checkbox
} from '@patternfly/react-core';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceFilterSelector, namespaceItemsSelector } from '../store/Selectors';
import { NamespaceActions } from '../actions/NamespaceAction';
import { NamespaceThunkActions } from '../actions/NamespaceThunkActions';
import { Namespace } from '../types/Namespace';
import { HistoryManager, URLParam } from '../app/History';
import {
  BoundingClientAwareComponent,
  PropertyType
} from './BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import { TourStop } from './Tour/TourStop';
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
  clearAll: () => void;
  disabled: boolean;
};

type NamespaceDropdownState = {
  isBulkSelectorOpen: boolean;
  isOpen: boolean;
  selectedNamespaces: Namespace[];
};

const optionBulkStyle = kialiStyle({
  marginLeft: '0.5rem',
  position: 'relative',
  top: 8
});

const optionStyle = kialiStyle({ marginLeft: '1.0rem' });

const optionLabelStyle = kialiStyle({ marginLeft: '0.5rem' });

const headerStyle = kialiStyle({
  margin: '0.5rem',
  marginTop: 0,
  width: 300
});

const marginBottom = 20;

const namespaceContainerStyle = kialiStyle({
  overflow: 'auto'
});

const dividerStyle = kialiStyle({
  paddingTop: '0.625rem'
});

const closeButtonStyle = kialiStyle({
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0
});

class NamespaceDropdownComponent extends React.PureComponent<NamespaceDropdownProps, NamespaceDropdownState> {
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
        <span style={{ paddingRight: '0.75rem' }}>Namespace:</span>
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
      <div className={optionBulkStyle}>
        <Checkbox
          id="bulk-select-id"
          key="bulk-select-key"
          aria-label="Select all"
          isChecked={isChecked}
          onChange={() => {
            anySelected ? this.onBulkNone() : this.onBulkAll();
          }}
        ></Checkbox>
        <span className={optionLabelStyle}>Select all</span>
      </div>
    );
  }

  private getHeader() {
    const hasFilter = !!this.props.filter;

    return (
      <div className={headerStyle}>
        <span style={{ display: 'flex' }}>
          <TextInput
            aria-label="filter-namespace"
            type="text"
            name="namespace-filter"
            placeholder="Filter by Name..."
            value={this.props.filter}
            onChange={(_event, value: string) => this.onFilterChange(value)}
          />
          {hasFilter && (
            <Tooltip key="ot_clear_namespace_filter" position="top" content="Clear Filter by Name">
              <Button className={closeButtonStyle} onClick={this.clearFilter} isInline>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          )}
        </span>
        {this.getBulkSelector()}
        <Divider className={dividerStyle} />
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
          className={optionStyle}
          id={`namespace-list-item[${namespace.name}]`}
          key={`namespace-list-item[${namespace.name}]`}
        >
          <input
            type="checkbox"
            value={namespace.name}
            checked={!!selectedMap[namespace.name]}
            onChange={this.onNamespaceToggled}
          />
          <span className={optionLabelStyle}>{namespace.name}</span>
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
    return <div className={optionStyle}>No namespaces found</div>;
  }

  render() {
    return (
      <TourStop info={GraphTourStops.Namespaces}>
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              data-test="namespace-dropdown"
              id="namespace-selector"
              onClick={() => this.onToggle(!this.state.isOpen)}
              isExpanded={this.state.isOpen}
              isDisabled={this.props.disabled}
            >
              {this.namespaceButtonText()}
            </MenuToggle>
          )}
          isOpen={this.state.isOpen}
          onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
        >
          <DropdownList>
            {this.getHeader()}
            {this.getBody()}
          </DropdownList>
        </Dropdown>
      </TourStop>
    );
  }

  private onToggle = (isOpen: boolean) => {
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
    return this.props.namespaces.filter(ns => ns.name.toLowerCase().includes(this.props.filter.toLowerCase()));
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

const mapDispatchToProps = (dispatch: KialiDispatch) => {
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

export const NamespaceDropdown = connect(mapStateToProps, mapDispatchToProps)(NamespaceDropdownComponent);
