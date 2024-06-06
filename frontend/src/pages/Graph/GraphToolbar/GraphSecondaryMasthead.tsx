import React from 'react';
import { SecondaryMasthead } from 'components/Nav/SecondaryMasthead';
import { NamespaceDropdown } from 'components/Dropdown/NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from '../GraphHelpTour';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
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
  marginLeft: '-1.25rem',
  marginRight: '-2.5rem'
});

const leftSpacerStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const vrStyle = kialiStyle({
  border: '1px inset',
  height: '1.25rem',
  margin: '0.25rem 0 0 0.5rem',
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

export const GraphSecondaryMasthead: React.FC<GraphSecondaryMastheadProps> = (props: GraphSecondaryMastheadProps) => {
  const setGraphType = (type: string): void => {
    const graphType: GraphType = GraphType[type] as GraphType;
    if (props.graphType !== graphType) {
      props.onGraphTypeChange(graphType);
    }
  };

  const graphTypeKey = _.findKey(GraphType, val => val === props.graphType)!;

  return (
    <SecondaryMasthead>
      <div className={mastheadStyle}>
        <NamespaceDropdown disabled={props.isNodeGraph} />

        <span className={vrStyle} />

        <TourStop info={GraphTourStops.GraphTraffic}>
          <span className={leftSpacerStyle}>
            <GraphTraffic disabled={props.disabled} />
          </span>
        </TourStop>

        <span className={vrStyle} />

        <TourStop info={GraphTourStops.GraphType}>
          <span className={leftSpacerStyle}>
            <ToolbarDropdown
              id={'graph_type_dropdown'}
              disabled={props.disabled || props.isNodeGraph}
              handleSelect={setGraphType}
              value={graphTypeKey}
              label={GRAPH_TYPES[graphTypeKey]}
              options={GRAPH_TYPES}
            />
          </span>
        </TourStop>

        <div className={rightToolbarStyle}>
          <TourStop info={GraphTourStops.TimeRange}>
            <TimeDurationComponent id="graph_time_range" disabled={props.disabled} supportsReplay={true} />
          </TourStop>
        </div>
      </div>
    </SecondaryMasthead>
  );
};
