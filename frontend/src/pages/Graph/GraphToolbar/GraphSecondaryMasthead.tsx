import * as React from 'react';
import { SecondaryMasthead } from 'components/Nav/SecondaryMasthead';
import { NamespaceDropdown } from 'components/Dropdown/NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from '../GraphHelpTour';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { GraphType } from 'types/Graph';
import { findKey } from 'lodash-es';
import { TimeDurationComponent } from '../../../components/Time/TimeDurationComponent';
import { GraphTraffic } from './GraphTraffic';
import { useKialiTranslation } from 'utils/I18nUtils';

type GraphSecondaryMastheadProps = {
  disabled: boolean;
  graphType: GraphType;
  isNodeGraph: boolean;
  onGraphTypeChange: (graphType: GraphType) => void;
};

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

const GRAPH_TYPE_LABELS: Record<string, string> = {
  APP: 'App graph',
  SERVICE: 'Service graph',
  VERSIONED_APP: 'Versioned app graph',
  WORKLOAD: 'Workload graph'
};

export const GraphSecondaryMasthead: React.FC<GraphSecondaryMastheadProps> = (props: GraphSecondaryMastheadProps) => {
  const { t, i18n } = useKialiTranslation();
  const graphTypes = React.useMemo(
    () => Object.fromEntries(Object.entries(GRAPH_TYPE_LABELS).map(([key, label]) => [key, t(label)])),
    [i18n.language, t]
  );

  const setGraphType = (type: string): void => {
    const graphType: GraphType = GraphType[type] as GraphType;
    if (props.graphType !== graphType) {
      props.onGraphTypeChange(graphType);
    }
  };

  const graphTypeKey = findKey(GraphType, val => val === props.graphType)!;

  return (
    <SecondaryMasthead>
      <>
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
              key={i18n.language}
              id={'graph_type_dropdown'}
              disabled={props.disabled || props.isNodeGraph}
              handleSelect={setGraphType}
              value={graphTypeKey}
              label={graphTypes[graphTypeKey]}
              options={graphTypes}
            />
          </span>
        </TourStop>

        <div className={rightToolbarStyle}>
          <TourStop info={GraphTourStops.TimeRange}>
            <TimeDurationComponent id="graph_time_range" disabled={props.disabled} supportsReplay={true} />
          </TourStop>
        </div>
      </>
    </SecondaryMasthead>
  );
};
