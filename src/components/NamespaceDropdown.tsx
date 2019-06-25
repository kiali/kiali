import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import _ from 'lodash';
import { style } from 'typestyle';
import { Button, FormControl, Icon, InputGroup, OverlayTrigger, Popover } from 'patternfly-react';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceFilterSelector, namespaceItemsSelector } from '../store/Selectors';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';
import NamespaceThunkActions from '../actions/NamespaceThunkActions';
import Namespace from '../types/Namespace';
import { PfColors } from './Pf/PfColors';
import { HistoryManager, URLParam } from '../app/History';
import {
  BoundingClientAwareComponent,
  PropertyType
} from './BoundingClientAwareComponent/BoundingClientAwareComponent';

const namespaceButtonColors = {
  backgroundColor: PfColors.White,
  fontSize: '1rem',
  color: '#282d33',
  textDecoration: 'none'
};

const namespaceButtonStyle = style({
  ...namespaceButtonColors,
  height: '32px',
  padding: '4px 6px 5px 6px',
  // these properties are being overridden by btn:hover/focus and btn-link:hover/focus
  $nest: {
    '&:hover': namespaceButtonColors,
    '&:focus': namespaceButtonColors
  }
});

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

export class NamespaceDropdown extends React.PureComponent<NamespaceDropdownProps> {
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

  onFilterChange = (event: any) => {
    this.props.setFilter(event.target.value);
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

  getPopoverContent() {
    if (this.props.items.length > 0) {
      const activeMap = this.props.activeNamespaces.reduce((map, namespace) => {
        map[namespace.name] = namespace.name;
        return map;
      }, {});
      const checkboxStyle = style({ marginLeft: 5 });
      const namespaces = this.props.items
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
              <span className={checkboxStyle}>{namespace.name}</span>
            </label>
          </div>
        ));

      return (
        <>
          <div>
            <InputGroup>
              <FormControl
                type="text"
                name="namespace-filter"
                placeholder="Filter by keyword..."
                value={this.props.filter}
                onChange={this.onFilterChange}
              />
              {this.props.filter !== '' && (
                <InputGroup.Button>
                  <Button onClick={this.clearFilter}>
                    <Icon name="close" />
                  </Button>
                </InputGroup.Button>
              )}
            </InputGroup>
          </div>
          <div className="text-right">
            <Button disabled={this.props.activeNamespaces.length === 0} bsStyle="link" onClick={this.props.clearAll}>
              Clear all
            </Button>
          </div>
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
    const popover = <Popover id="namespace-list-layers-popover">{this.getPopoverContent()}</Popover>;
    return (
      <OverlayTrigger
        onEnter={this.props.refresh}
        overlay={popover}
        placement="bottom"
        trigger={['click']}
        rootClose={true}
      >
        <Button bsClass={`btn btn-link btn-lg  ${namespaceButtonStyle}`} id="namespace-selector">
          {this.namespaceButtonText()} <Icon name="angle-down" />
        </Button>
      </OverlayTrigger>
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
