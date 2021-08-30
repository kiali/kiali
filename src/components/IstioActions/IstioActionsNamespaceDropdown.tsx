import * as React from 'react';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import history from '../../app/History';
import { NEW_ISTIO_RESOURCE } from '../../pages/IstioConfigNew/IstioConfigNewPage';
import { serverConfig } from 'config';

type Props = {};

type State = {
  dropdownOpen: boolean;
};

type ActionItem = {
  name: string;
  action: JSX.Element;
};

class IstioActionsNamespaceDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      dropdownOpen: false
    };
  }

  onSelect = _ => {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
  };

  onToggle = (dropdownState: boolean) => {
    this.setState({
      dropdownOpen: dropdownState
    });
  };

  onClickCreate = (type: string) => {
    history.push('/istio/new/' + type);
  };

  renderTooltip = (key, position, msg, child): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed', textAlign: 'left' }}>{child}</div>
      </Tooltip>
    );
  };

  render() {
    const dropdownItemsRaw = NEW_ISTIO_RESOURCE.map(
      (r): ActionItem => ({
        name: r.value,
        action: (
          <DropdownItem
            isDisabled={serverConfig.deployment.viewOnlyMode}
            key={'createIstioConfig_' + r.value}
            onClick={() => this.onClickCreate(r.value)}
          >
            {r.label}
          </DropdownItem>
        )
      })
    );

    const dropdownItems = [
      <DropdownGroup
        key={'group_create'}
        label={'Create'}
        className="kiali-group-menu"
        children={dropdownItemsRaw.map(r =>
          serverConfig.deployment.viewOnlyMode
            ? this.renderTooltip(r.name, TooltipPosition.left, 'User has not permissions', r.action)
            : r.action
        )}
      />
    ];
    return (
      <Dropdown
        id="actions"
        toggle={<DropdownToggle onToggle={this.onToggle}>Actions</DropdownToggle>}
        onSelect={this.onSelect}
        position={DropdownPosition.right}
        isOpen={this.state.dropdownOpen}
        dropdownItems={dropdownItems}
      />
    );
  }
}

export default IstioActionsNamespaceDropdown;
