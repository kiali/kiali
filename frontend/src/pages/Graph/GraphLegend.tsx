import * as React from 'react';
import { style } from 'typestyle';
import legendData, { GraphLegendItem, GraphLegendItemRow } from './GraphLegendData';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import CloseIcon from '@patternfly/react-icons/dist/js/icons/close-icon';
import { PFColors } from 'components/Pf/PfColors';
import { summaryFont, summaryTitle } from './SummaryPanelCommon';

export interface GraphLegendProps {
  closeLegend: () => void;
  className?: string;
  isMTLSEnabled: boolean;
}

const width = '190px';

export default class GraphLegend extends React.Component<GraphLegendProps> {
  render() {
    const legendBoxStyle = style({
      backgroundColor: PFColors.White,
      border: '1px #ddd solid',
      margin: '0 0 3.25em 0',
      overflow: 'hidden',
      overflowY: 'auto',
      padding: '1em 0.5em 1em 1em',
      zIndex: 3
    });

    const headerStyle = style({
      width: width
    });

    const bodyStyle = style({
      height: 'auto',
      width: width
    });

    const closeBoxStyle = style({
      float: 'right',
      margin: '-7px -5px 0 -10px'
    });

    return (
      <div className={legendBoxStyle} style={summaryFont}>
        <div className={`${headerStyle} ${summaryTitle}`}>
          <span>Legend</span>
          <span className={closeBoxStyle}>
            <Tooltip content="Close Legend">
              <Button id="legend_close" variant={ButtonVariant.plain} onClick={this.props.closeLegend}>
                <CloseIcon />
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

  renderGraphLegendList(legendData: GraphLegendItem[]) {
    const legendColumnHeadingStyle = style({
      fontWeight: 'bold',
      paddingTop: '1.25em'
    });
    const aStyle = style({
      height: '100%'
    });

    return (
      <div className={aStyle}>
        {legendData.map((legendItem: GraphLegendItem) => (
          <div key={legendItem.title} className={legendColumnHeadingStyle}>
            {legendItem.title}
            {this.renderLegendRowItems(legendItem.data)}
          </div>
        ))}
      </div>
    );
  }

  renderLegendRowItems(legendData: GraphLegendItemRow[]) {
    return (
      <>{legendData.map((legendItemRow: GraphLegendItemRow) => GraphLegend.renderLegendIconAndLabel(legendItemRow))}</>
    );
  }

  static renderLegendIconAndLabel(legendItemRow: GraphLegendItemRow) {
    const keyWidth = '70px';

    const keyStyle = style({
      minWidth: keyWidth,
      width: keyWidth
    });

    const legendItemStyle = style({
      display: 'flex',
      flexDirection: 'row',
      padding: '5px 5px 0 5px'
    });

    const legendItemLabelStyle = style({
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
  }
}
