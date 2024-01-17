import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { Status } from '../../types/Health';
import { Paths } from '../../config';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from '../../types/Filters';
import { healthFilter } from '../../components/Filters/CommonFilters';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskGraphAction } from '../../components/Kiosk/KioskActions';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import { healthIndicatorStyle } from 'styles/HealthStyle';
import { createIcon } from 'config/KialiIcon';

type ReduxProps = {
  duration: DurationInSeconds;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
};

type Props = ReduxProps & {
  id: string;
  items: string[];
  namespace: string;
  status: Status;
  targetPage: Paths;
};

const OverviewStatusComponent: React.FC<Props> = (props: Props) => {
  const setFilters = (): void => {
    const filters: ActiveFilter[] = [
      {
        category: healthFilter.category,
        value: props.status.name
      }
    ];

    FilterSelected.setSelected({ filters: filters, op: DEFAULT_LABEL_OPERATION });
  };

  const linkAction = (): void => {
    // Kiosk actions are used when the kiosk specifies a parent,
    // otherwise the kiosk=true will keep the links inside Kiali
    if (isParentKiosk(props.kiosk)) {
      kioskGraphAction(props.namespace, props.status.name, props.duration, props.refreshInterval, props.targetPage);
    } else {
      setFilters();
    }
  };

  const length = props.items.length;
  let items = props.items;

  if (items.length > 6) {
    items = items.slice(0, 5);
    items.push(`and ${length - items.length} more...`);
  }

  const tooltipContent = (
    <div>
      <strong>{props.status.name}</strong>

      {items.map((app, idx) => {
        return (
          <div data-test={`${props.id}-${app}`} key={`${props.id}-${idx}`}>
            <span style={{ marginRight: '0.5rem' }}>{createIcon(props.status)}</span> {app}
          </div>
        );
      })}
    </div>
  );

  return (
    <Tooltip
      aria-label={'Overview status'}
      position={TooltipPosition.auto}
      content={tooltipContent}
      className={healthIndicatorStyle}
    >
      <div style={{ display: 'inline-block', marginRight: '0.375rem' }}>
        <Link to={`/${props.targetPage}?namespaces=${props.namespace}`} onClick={() => linkAction()}>
          {createIcon(props.status)}
          {` ${length}`}
        </Link>
      </div>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  kiosk: state.globalState.kiosk,
  refreshInterval: refreshIntervalSelector(state)
});

export const OverviewStatus = connect(mapStateToProps)(OverviewStatusComponent);
