import {
  Checkbox,
  Tooltip,
  TooltipPosition,
  Dropdown,
  DropdownList,
  MenuToggleElement,
  MenuToggle
} from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { KialiAppState, MeshToolbarState } from '../../../store/Store';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import {
  containerStyle,
  itemStyleWithInfo,
  itemStyleWithoutInfo,
  menuStyle,
  menuEntryStyle,
  titleStyle
} from 'styles/DropdownStyles';
import { KialiDispatch } from 'types/Redux';
import { KialiCrippledFeatures } from 'types/ServerConfig';
import { serverConfig } from '../../../config';
import { infoStyle } from 'styles/IconStyle';
import { INITIAL_MESH_STATE } from 'reducers/MeshDataState';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';

type ReduxStateProps = {
  showGateways: boolean;
  showWaypoints: boolean;
};

type ReduxDispatchProps = {
  toggleGateways(): void;
  toggleWaypoints(): void;
};

type MeshSettingsProps = ReduxStateProps &
  ReduxDispatchProps &
  Omit<MeshToolbarState, 'findValue' | 'hideValue' | 'showFindHelp' | 'showLegend'> & {
    disabled: boolean;
  };

type MeshSettingsState = { crippledFeatures?: KialiCrippledFeatures; isOpen: boolean };

interface DisplayOptionType {
  iconClassName?: string;
  iconColor?: string;
  id: string;
  isChecked: boolean;
  isDisabled?: boolean;
  labelText: string;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

class MeshSettingsComponent extends React.PureComponent<MeshSettingsProps, MeshSettingsState> {
  constructor(props: MeshSettingsProps) {
    super(props);

    this.state = {
      isOpen: false
    };

    // Let URL override current redux state at construction time. Update URL as needed.
    this.handleURLBool(
      URLParam.MESH_GATEWAYS,
      INITIAL_MESH_STATE.toolbarState.showGateways,
      props.showGateways,
      props.toggleGateways
    );

    this.handleURLBool(
      URLParam.MESH_WAYPOINTS,
      INITIAL_MESH_STATE.toolbarState.showWaypoints,
      props.showWaypoints,
      props.toggleWaypoints
    );
  }

  componentDidUpdate(prev: MeshSettingsProps): void {
    // ensure redux state and URL are aligned
    this.alignURLBool(
      URLParam.MESH_GATEWAYS,
      INITIAL_MESH_STATE.toolbarState.showGateways,
      prev.showGateways,
      this.props.showGateways
    );

    this.alignURLBool(
      URLParam.MESH_WAYPOINTS,
      INITIAL_MESH_STATE.toolbarState.showWaypoints,
      prev.showWaypoints,
      this.props.showWaypoints
    );
  }

  private handleURLBool = (
    param: URLParam,
    paramDefault: boolean,
    reduxValue: boolean,
    reduxToggle: () => void
  ): void => {
    const urlValue = HistoryManager.getBooleanParam(param);

    if (urlValue !== undefined) {
      if (urlValue !== reduxValue) {
        reduxToggle();
      }
    } else if (reduxValue !== paramDefault) {
      HistoryManager.setParam(param, String(reduxValue));
    }
  };

  private alignURLBool = (param: URLParam, paramDefault: boolean, prev: boolean, curr: boolean): void => {
    if (prev === curr) {
      return;
    }

    if (curr === paramDefault) {
      HistoryManager.deleteParam(param);
    } else {
      HistoryManager.setParam(param, String(curr));
    }
  };

  render(): React.ReactNode {
    return (
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            id="display-settings"
            onClick={() => this.onToggle(!this.state.isOpen)}
            isExpanded={this.state.isOpen}
            isDisabled={this.props.disabled}
          >
            Display
          </MenuToggle>
        )}
        isOpen={this.state.isOpen}
        onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
      >
        <DropdownList>{this.getMenuOptions()}</DropdownList>
      </Dropdown>
    );
  }

  private onToggle = (isOpen: boolean): void => {
    this.setState({
      isOpen
    });
  };

  private getMenuOptions = (): React.ReactNode => {
    // map our attributes from redux
    const { showGateways, showWaypoints } = this.props;

    // map our dispatchers for redux
    const { toggleGateways, toggleWaypoints } = this.props;

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'filterGateways',
        isChecked: showGateways,
        labelText: 'Gateways',
        onChange: toggleGateways,
        tooltip: <div style={{ textAlign: 'left' }}>When enabled, include gateways in the mesh topology.</div>
      }
    ];

    if (serverConfig.ambientEnabled) {
      visibilityOptions.push({
        id: 'filterWaypoints',
        isChecked: showWaypoints,
        labelText: 'Waypoints',
        onChange: toggleWaypoints,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>Show waypoint proxies workloads.</div>
            <div>When enabled in an Ambient environment, include waypoints in the mesh topology.</div>
          </div>
        )
      });
    }

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-display-menu" className={menuStyle} style={{ width: '15em' }}>
          <div className={titleStyle}>Show</div>

          {visibilityOptions.map((item: DisplayOptionType) => (
            <div key={item.id} className={menuEntryStyle}>
              <label key={item.id} className={item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  isDisabled={this.props.disabled || item.isDisabled}
                  label={item.labelText}
                  onChange={item.onChange}
                />
              </label>

              {item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.right} content={item.tooltip}>
                  <KialiIcon.Info className={item.iconClassName ?? infoStyle} color={item.iconColor} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  showGateways: state.mesh.toolbarState.showGateways,
  showWaypoints: state.mesh.toolbarState.showWaypoints
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    toggleGateways: bindActionCreators(MeshToolbarActions.toggleGateways, dispatch),
    toggleWaypoints: bindActionCreators(MeshToolbarActions.toggleWaypoints, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
export const MeshSettings = connect(mapStateToProps, mapDispatchToProps)(MeshSettingsComponent);
