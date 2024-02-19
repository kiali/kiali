import React from 'react';
import { SecondaryMasthead } from 'components/Nav/SecondaryMasthead';
import { NamespaceDropdown } from 'components/NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from '../GraphHelpTour';
import { ToolbarDropdown } from 'components/ToolbarDropdown/ToolbarDropdown';
import { GraphType } from 'types/Graph';
import * as _ from 'lodash';
import { TimeDurationComponent } from '../../../components/Time/TimeDurationComponent';
import { GraphTraffic } from './GraphTraffic';

type GraphSecondaryMastheadProps = {
  disabled: boolean;
  graphType: GraphType;
  isNodeGraph: boolean;
  onGraphTypeChange: (graphType: GraphType) => void;
};

const mastheadStyle = kialiStyle({
  marginLeft: '-20px',
  marginRight: '-40px'
});

const leftSpacerStyle = kialiStyle({
  marginLeft: '10px'
});

const vrStyle = kialiStyle({
  border: '1px inset',
  height: '20px',
  margin: '4px 0 0 10px',
  width: '1px'
});

const rightToolbarStyle = kialiStyle({
  float: 'right'
});

/**
 *  Key-value pair object representation of GraphType enum.  Values are human-readable versions of enum keys.
 *
 *  Example:  GraphType => {'APP': 'App', 'VERSIONED_APP': 'VersionedApp'}
 */
const GRAPH_TYPES = _.mapValues(GraphType, val => `${_.capitalize(_.startCase(val))} graph`);

export class GraphSecondaryMasthead extends React.PureComponent<GraphSecondaryMastheadProps> {
  render() {
    const graphTypeKey: string = _.findKey(GraphType, val => val === this.props.graphType)!;

    return (
      <SecondaryMasthead>
        <div className={mastheadStyle}>
          <NamespaceDropdown disabled={this.props.isNodeGraph} />
          <span className={vrStyle} />
          <TourStop info={GraphTourStops.GraphTraffic}>
            <span className={leftSpacerStyle}>
              <GraphTraffic disabled={this.props.disabled} />
            </span>
          </TourStop>
          <span className={vrStyle} />
          <TourStop info={GraphTourStops.GraphType}>
            <span className={leftSpacerStyle}>
              <ToolbarDropdown
                id={'graph_type_dropdown'}
                disabled={this.props.disabled || this.props.isNodeGraph}
                handleSelect={this.setGraphType}
                value={graphTypeKey}
                label={GRAPH_TYPES[graphTypeKey]}
                options={GRAPH_TYPES}
              />
            </span>
          </TourStop>
          <div className={rightToolbarStyle}>
            <TourStop info={GraphTourStops.TimeRange}>
              <TimeDurationComponent id="graph_time_range" disabled={this.props.disabled} supportsReplay={true} />
            </TourStop>
          </div>
        </div>
      </SecondaryMasthead>
    );
  }

  private setGraphType = (type: string) => {
    const graphType: GraphType = GraphType[type] as GraphType;
    if (this.props.graphType !== graphType) {
      this.props.onGraphTypeChange(graphType);
    }
  };
}
