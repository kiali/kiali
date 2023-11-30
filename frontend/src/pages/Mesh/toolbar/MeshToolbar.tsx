import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { connect } from 'react-redux';
import { KialiAppState } from '../../../store/Store';
import { KialiDispatch } from '../../../types/Redux';
import { TourStop } from 'components/Tour/TourStop';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshTarget } from 'types/Mesh';
import { Controller } from '@patternfly/react-topology';
import { MeshFind } from './MeshFind';
import { MeshTourStops } from '../MeshHelpTour';
import { MeshReset } from './MeshReset';
import { Refresh } from 'components/Refresh/Refresh';

type ReduxProps = {
  target: MeshTarget | null;
};

type MeshToolbarProps = ReduxProps & {
  controller: Controller;
  disabled: boolean;
  elementsChanged: boolean;
  onToggleHelp: () => void;
};

const helpStyle = kialiStyle({
  marginRight: '0.5rem',
  alignSelf: 'center'
});

class MeshToolbarComponent extends React.PureComponent<MeshToolbarProps> {
  static contextTypes = {
    router: () => null
  };

  render() {
    return (
      <>
        <Toolbar style={{ width: '100%' }}>
          <ToolbarGroup aria-label="mesh settings" style={{ margin: 0, alignItems: 'flex-start' }}>
            <ToolbarItem>
              <MeshFind controller={this.props.controller} elementsChanged={this.props.elementsChanged} />
            </ToolbarItem>

            <ToolbarItem style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              <Tooltip key={'mesh-tour-help-ot'} position={TooltipPosition.right} content="Shortcuts and tips...">
                <TourStop info={MeshTourStops.Shortcuts}>
                  <Button
                    id="mesh-tour"
                    variant={ButtonVariant.link}
                    className={helpStyle}
                    onClick={this.props.onToggleHelp}
                    isInline
                  >
                    <KialiIcon.Help />
                    <span style={{ marginLeft: '5px' }}>Help</span>
                  </Button>
                </TourStop>
              </Tooltip>
              <MeshReset />
            </ToolbarItem>
            <ToolbarItem>
              <Refresh id="time_range_refresh" disabled={this.props.disabled} hideLabel={true} manageURL={true} />
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  target: state.mesh.target
});

const mapDispatchToProps = (_dispatch: KialiDispatch) => {
  return {};
};

export const MeshToolbar = connect(mapStateToProps, mapDispatchToProps)(MeshToolbarComponent);
