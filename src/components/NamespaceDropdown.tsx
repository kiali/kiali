import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceItemsSelector } from '../store/Selectors';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphActions } from '../actions/GraphActions';
import { NamespaceActions } from '../actions/NamespaceAction';
import NamespaceThunkActions from '../actions/NamespaceThunkActions';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import Namespace from '../types/Namespace';
import { style } from 'typestyle';
import { PfColors } from './Pf/PfColors';

const namespaceButtonStyle = style({
  color: PfColors.Black,
  outline: 'none',
  $nest: {
    '&:hover': {
      textDecoration: 'none',
      color: PfColors.Black,
      outline: 'none',
      boxShadow: 'none'
    },
    '&:focus': {
      textDecoration: 'none',
      color: PfColors.Black,
      outline: 'none',
      boxShadow: 'none'
    }
  }
});

interface NamespaceListType {
  disabled: boolean;
  activeNamespaces: Namespace[];
  items: Namespace[];
  toggleNamespace: (namespace: Namespace) => void;
  refresh: () => void;
  clearAll: () => void;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, {}> {
  constructor(props: NamespaceListType) {
    super(props);
  }

  componentDidMount() {
    this.props.refresh();
  }

  onNamespaceToggled = (a: any) => {
    this.props.toggleNamespace({ name: a.target.value });
  };

  namespaceButtonText() {
    if (this.props.activeNamespaces.length === 0) {
      return 'Select a namespace';
    } else if (this.props.activeNamespaces.length === 1) {
      return `Namespace: ${this.props.activeNamespaces[0].name}`;
    } else {
      return `Namespaces: ${this.props.activeNamespaces.length} namespaces`;
    }
  }

  getPopoverContent() {
    if (this.props.items.length > 0) {
      const activeMap = this.props.activeNamespaces.reduce((map, namespace) => {
        map[namespace.name] = namespace.name;
        return map;
      }, {});
      const checkboxStyle = style({ marginLeft: 5 });
      const namespaces = this.props.items.map((namespace: Namespace) => (
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
          <div className="text-right">
            <Button disabled={this.props.activeNamespaces.length === 0} bsStyle="link" onClick={this.props.clearAll}>
              Clear all
            </Button>
          </div>
          <div>{namespaces}</div>
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
        <Button bsClass={`btn btn-link btn-lg  ${namespaceButtonStyle}`} id="graph_settings">
          {this.namespaceButtonText()} <Icon name="angle-down" />
        </Button>
      </OverlayTrigger>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    items: namespaceItemsSelector(state)!,
    activeNamespaces: activeNamespacesSelector(state)
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    },
    toggleNamespace: (namespace: Namespace) => {
      // TODO: This needs to be a single update
      dispatch(GraphActions.changed());
      dispatch(NamespaceActions.toggleActiveNamespace(namespace));
    },
    clearAll: () => {
      dispatch(GraphActions.changed());
      dispatch(NamespaceActions.setActiveNamespaces([]));
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
