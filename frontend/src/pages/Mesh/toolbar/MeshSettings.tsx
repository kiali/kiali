import { Checkbox, Dropdown, DropdownList, MenuToggleElement, MenuToggle } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { KialiAppState, MeshToolbarState } from '../../../store/Store';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { ToolbarDropdownHelpRow } from 'components/ToolbarDropdown/ToolbarDropdownHelpRow';
import { containerStyle, itemStyleWithoutInfo, menuStyle, titleStyle } from 'styles/DropdownStyles';
import { KialiDispatch } from 'types/Redux';
import { serverConfig } from '../../../config';
import { INITIAL_MESH_STATE } from 'reducers/MeshDataState';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { useKialiTranslation } from 'utils/I18nUtils';

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

const MeshSettingsComponent: React.FC<MeshSettingsProps> = (props: MeshSettingsProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const { t } = useKialiTranslation();

  const renderDisplayMenuRow = (
    rowId: string,
    content: React.ReactNode,
    tooltipContent?: React.ReactNode,
    headerTitle?: React.ReactNode
  ): React.ReactNode => {
    return (
      <ToolbarDropdownHelpRow key={rowId} helpBody={tooltipContent} helpTitle={headerTitle}>
        {content}
      </ToolbarDropdownHelpRow>
    );
  };

  const getMenuOptions = (): React.ReactNode => {
    // map our attributes from redux
    const { showGateways, showWaypoints } = props;

    // map our dispatchers for redux
    const { toggleGateways, toggleWaypoints } = props;

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'filterGateways',
        isChecked: showGateways,
        labelText: t('Gateways'),
        onChange: toggleGateways,
        tooltip: <div>{t('When enabled, include gateways in the mesh topology.')}</div>
      }
    ];

    if (serverConfig.ambientEnabled) {
      visibilityOptions.push({
        id: 'filterWaypoints',
        isChecked: showWaypoints,
        labelText: t('Waypoints'),
        onChange: toggleWaypoints,
        tooltip: <div>{t('When enabled in an Ambient environment, include waypoints in the mesh topology.')}</div>
      });
    }

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="mesh-display-menu" className={menuStyle} style={{ width: '15em' }}>
          <div className={titleStyle}>{t('Show')}</div>

          {visibilityOptions.map((item: DisplayOptionType) =>
            renderDisplayMenuRow(
              `visibility-${item.id}`,
              <label key={item.id} className={itemStyleWithoutInfo}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  isDisabled={props.disabled || item.isDisabled}
                  label={item.labelText}
                  onChange={item.onChange}
                />
              </label>,
              item.tooltip,
              item.labelText
            )
          )}
        </div>
      </BoundingClientAwareComponent>
    );
  };

  return (
    <Dropdown
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          id="display-settings"
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
          isDisabled={props.disabled}
        >
          {t('Display')}
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
    >
      <DropdownList>{getMenuOptions()}</DropdownList>
    </Dropdown>
  );
};

const withURLAwareness = (
  MeshSettingsComponent: React.FC<MeshSettingsProps>
): React.ComponentClass<MeshSettingsProps> => {
  return class extends React.Component<MeshSettingsProps> {
    constructor(props: MeshSettingsProps) {
      super(props);

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

    componentDidUpdate(prev: MeshSettingsProps): void {
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

    render(): React.ReactNode {
      return <MeshSettingsComponent {...this.props} />;
    }
  };
};

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

export const MeshSettings = connect(mapStateToProps, mapDispatchToProps)(withURLAwareness(MeshSettingsComponent));
