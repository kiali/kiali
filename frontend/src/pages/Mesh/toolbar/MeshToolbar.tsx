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
import { TourStop } from 'components/Tour/TourStop';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshTarget } from 'types/Mesh';
import { Controller } from '@patternfly/react-topology';
import { MeshFind } from './MeshFind';
import { MeshTourStops } from '../MeshHelpTour';
import { MeshReset } from './MeshReset';
import { TimeDurationComponent } from 'components/Time/TimeDurationComponent';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  target: MeshTarget | null;
};

type MeshToolbarProps = ReduxProps & {
  controller?: Controller;
  disabled: boolean;
  elementsChanged: boolean;
  onToggleHelp: () => void;
};

const helpStyle = kialiStyle({
  marginRight: '0.5rem',
  alignSelf: 'center'
});

export const MeshToolbarComponent: React.FC<MeshToolbarProps> = (props: MeshToolbarProps) => {
  const { t } = useKialiTranslation();

  return (
    <>
      <Toolbar style={{ width: '100%' }}>
        <ToolbarGroup aria-label={t('mesh settings')} style={{ margin: 0, alignItems: 'flex-start' }}>
          <ToolbarItem>
            <MeshFind controller={props.controller} elementsChanged={props.elementsChanged} />
          </ToolbarItem>

          <ToolbarItem style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <Tooltip key={'mesh-tour-help-ot'} position={TooltipPosition.right} content={t('Shortcuts and tips...')}>
              <TourStop info={MeshTourStops.Shortcuts}>
                <Button
                  id="mesh-tour"
                  variant={ButtonVariant.link}
                  className={helpStyle}
                  onClick={props.onToggleHelp}
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
            <TourStop info={MeshTourStops.TimeRange}>
              <TimeDurationComponent id="mesh_time_range" disabled={props.disabled} supportsReplay={false} />
            </TourStop>
          </ToolbarItem>
        </ToolbarGroup>
      </Toolbar>
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  target: state.mesh.target
});

export const MeshToolbar = connect(mapStateToProps)(MeshToolbarComponent);
