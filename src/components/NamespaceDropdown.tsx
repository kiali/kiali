import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceItemsSelector } from '../store/Selectors';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';
import NamespaceThunkActions from '../actions/NamespaceThunkActions';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import Namespace from '../types/Namespace';
import { style } from 'typestyle';
import { PfColors } from './Pf/PfColors';

const namespaceButtonColors = {
  backgroundColor: PfColors.White,
  borderColor: '#18546B',
  color: '#003145'
};

const namespaceButtonStyle = style({
  ...namespaceButtonColors,
  borderRadius: '2px 2px 0 0',
  borderWidth: '1px 1px 3px 1px',
  height: '32px',
  boxSizing: 'border-box',
  padding: '4px 6px 5px 6px',
  // these properties are being overridden by btn:hover/focus and btn-link:hover/focus
  $nest: {
    '&:hover': namespaceButtonColors,
    '&:focus': namespaceButtonColors
  }
});

const namespaceLabelStyle = style({
  fontWeight: 500
});

const namespaceValueStyle = style({
  fontWeight: 600
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
    activeNamespaces: activeNamespacesSelector(state)
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
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
