import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { legendData, MeshLegendItem, MeshLegendItemRow } from './MeshLegendData';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';

// This is just a shell, Legend is a TODO!!!!!

export interface MeshLegendProps {
  className?: string;
  closeLegend: () => void;
}

const width = '190px';

export class MeshLegend extends React.Component<MeshLegendProps> {
  render(): React.ReactNode {
    const legendBoxStyle = kialiStyle({
      backgroundColor: PFColors.BackgroundColor100,
      border: `1px solid ${PFColors.BorderColor100}`,
      margin: '0 0 3.25em 0',
      overflow: 'hidden',
      overflowY: 'auto',
      padding: '1em 0.5em 1em 1em',
      zIndex: 3
    });

    const headerStyle = kialiStyle({
      width: width
    });

    const bodyStyle = kialiStyle({
      height: 'auto',
      width: width
    });

    const closeBoxStyle = kialiStyle({
      float: 'right',
      margin: '-7px -5px 0 -10px'
    });

    return (
      <div className={legendBoxStyle} data-test="graph-legend">
        <div className={`${headerStyle}`}>
          <span>Legend</span>
          <span className={closeBoxStyle}>
            <Tooltip content="Close Legend">
              <Button id="legend_close" variant={ButtonVariant.plain} onClick={this.props.closeLegend}>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          </span>
        </div>

        <div className={bodyStyle}>
          <div>{this.renderGraphLegendList(legendData)}</div>
        </div>
      </div>
    );
  }

  renderGraphLegendList = (legendData: MeshLegendItem[]): React.ReactNode => {
    const legendColumnHeadingStyle = kialiStyle({
      fontWeight: 'bold',
      paddingTop: '1.25em'
    });

    const aStyle = kialiStyle({
      height: '100%'
    });

    return (
      <div className={aStyle}>
        {legendData.map((legendItem: MeshLegendItem) => (
          <div key={legendItem.title} className={legendColumnHeadingStyle}>
            {legendItem.title}

            {this.renderLegendRowItems(legendItem.data)}
          </div>
        ))}
      </div>
    );
  };

  renderLegendRowItems = (legendData: MeshLegendItemRow[]): React.ReactNode => {
    return (
      <>{legendData.map((legendItemRow: MeshLegendItemRow) => MeshLegend.renderLegendIconAndLabel(legendItemRow))}</>
    );
  };

  static renderLegendIconAndLabel = (legendItemRow: MeshLegendItemRow): React.ReactNode => {
    const keyWidth = '70px';

    const keyStyle = kialiStyle({
      minWidth: keyWidth,
      width: keyWidth
    });

    const legendItemStyle = kialiStyle({
      display: 'flex',
      flexDirection: 'row',
      padding: '5px 5px 0 5px'
    });

    const legendItemLabelStyle = kialiStyle({
      fontWeight: 'normal'
    });

    return (
      <div key={legendItemRow.icon} className={legendItemStyle}>
        <span className={keyStyle}>
          <img alt={legendItemRow.label} src={legendItemRow.icon} />
        </span>

        <span className={legendItemLabelStyle}>{legendItemRow.label}</span>
      </div>
    );
  };
}
