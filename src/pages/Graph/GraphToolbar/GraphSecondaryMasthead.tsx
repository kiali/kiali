import React from 'react';
import SecondaryMasthead from 'components/Nav/SecondaryMasthead';
import NamespaceDropdownContainer from 'components/NamespaceDropdown';
import { style } from 'typestyle';
import TourStopContainer from 'components/Tour/TourStop';
import { GraphTourStops } from '../GraphHelpTour';
import ToolbarDropdown from 'components/ToolbarDropdown/ToolbarDropdown';
import { GraphType } from 'types/Graph';
import * as _ from 'lodash';
import TimeDurationContainer from '../../../components/Time/TimeDurationComponent';

type GraphSecondaryMastheadProps = {
  disabled: boolean;
  graphType: GraphType;
  isNodeGraph: boolean;

  onToggleHelp: () => void;
  onGraphTypeChange: (graphType: GraphType) => void;
  onHandleRefresh: () => void;
};

const mastheadStyle = style({
  marginLeft: '-20px',
  marginRight: '-40px'
});

const leftSpacerStyle = style({
  marginLeft: '10px'
});

const vrStyle = style({
  border: '1px inset',
  height: '20px',
  margin: '4px 0 0 10px',
  width: '1px'
});

const rightToolbarStyle = style({
  float: 'right'
});

/**
 *  Key-value pair object representation of GraphType enum.  Values are human-readable versions of enum keys.
 *
 *  Example:  GraphType => {'APP': 'App', 'VERSIONED_APP': 'VersionedApp'}
 */
const GRAPH_TYPES = _.mapValues(GraphType, val => `${_.capitalize(_.startCase(val))} graph`);

export default class GraphSecondaryMasthead extends React.PureComponent<GraphSecondaryMastheadProps> {
  render() {
    const graphTypeKey: string = _.findKey(GraphType, val => val === this.props.graphType)!;

    return (
      <SecondaryMasthead title={false}>
        <div className={mastheadStyle}>
          <NamespaceDropdownContainer disabled={this.props.isNodeGraph} />
          <span className={vrStyle} />
          <TourStopContainer info={GraphTourStops.GraphType}>
            <span className={leftSpacerStyle}>
              <ToolbarDropdown
                id={'graph_filter_view_type'}
                disabled={this.props.disabled}
                handleSelect={this.setGraphType}
                value={graphTypeKey}
                label={GRAPH_TYPES[graphTypeKey]}
                options={GRAPH_TYPES}
              />
            </span>
          </TourStopContainer>
          <div className={rightToolbarStyle}>
            <TourStopContainer info={GraphTourStops.TimeRange}>
              <TimeDurationContainer
                id="graph_time_range"
                disabled={this.props.disabled}
                handleRefresh={this.props.onHandleRefresh}
                supportsReplay={true}
              />
            </TourStopContainer>
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
