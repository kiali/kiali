import * as React from 'react';
import { style } from 'typestyle';
import legendData, { GraphLegendItem, GraphLegendItemRow } from './GraphLegendData';
import { Button, Tooltip } from '@patternfly/react-core';
import CloseIcon from '@patternfly/react-icons/dist/js/icons/close-icon';

export interface GraphLegendProps {
  closeLegend: () => void;
  className?: string;
  isMTLSEnabled: boolean;
}

const width = '200px';

export default class GraphLegend extends React.Component<GraphLegendProps> {
  render() {
    const legendBoxStyle = style({
      margin: '1em 0 4em 0',
      padding: '1em',
      border: '1px solid #EDEDED',
      overflow: 'hidden',
      overflowX: 'auto',
      overflowY: 'auto'
    });

    const headerStyle = style({
      width: width
    });

    const legendTextHeadingStyle = style({
      fontWeight: 'bold',
      fontSize: '16px'
    });

    const bodyStyle = style({
      width: width,
      height: 'auto'
    });

    const legendListStyle = style({
      display: 'flex',
      flexDirection: 'column'
    });

    const closeBoxStyle = style({
      float: 'right',
      marginTop: '-7px'
    });

    return (
      <div className={legendBoxStyle}>
        <div className={headerStyle}>
          <span className={legendTextHeadingStyle}>Legend</span>
          <span className={closeBoxStyle}>
            <Tooltip content="Close Legend">
              <Button id="legend_close" variant="plain" onClick={this.props.closeLegend}>
                <CloseIcon />
              </Button>
            </Tooltip>
          </span>
        </div>
        <div className={bodyStyle}>
          <div className={legendListStyle}>{this.renderGraphLegendList(legendData)}</div>
        </div>
      </div>
    );
  }

  renderGraphLegendList(legendData: GraphLegendItem[]) {
    const legendColumnHeadingStyle = style({
      paddingTop: '1.25em',
      fontSize: '14px'
    });
    const aStyle = style({
      height: '100%',
      width: width
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
    const legendItemContainerStyle = style({
      fontSize: '1em',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: '5px 5px 0 5px'
    });

    const legendItemLabelStyle = style({
      fontSize: '12px',
      fontWeight: 'normal',
      width: '130px',
      marginTop: '3px'
    });

    return (
      <div key={legendItemRow.icon} className={legendItemContainerStyle}>
        <span>
          <img alt={legendItemRow.label} src={legendItemRow.icon} />
        </span>
        <span className={legendItemLabelStyle}>{legendItemRow.label}</span>
      </div>
    );
  }
}
