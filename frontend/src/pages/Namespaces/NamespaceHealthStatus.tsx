import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY, NA, Status } from '../../types/Health';
import { NamespaceStatus } from '../../types/NamespaceInfo';
import { Paths } from '../../config';
import { useKialiTranslation } from 'utils/I18nUtils';
import { createIcon } from '../../config/KialiIcon';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from '../../types/Filters';
import { healthFilter } from '../../components/Filters/CommonFilters';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskGraphAction } from '../../components/Kiosk/KioskActions';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';

type ReduxProps = {
  duration: DurationInSeconds;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
};

type Props = ReduxProps & {
  name: string;
  statusApp?: NamespaceStatus;
  statusService?: NamespaceStatus;
  statusWorkload?: NamespaceStatus;
};

const NamespaceHealthStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const setFilters = (status: Status): void => {
    const filters: ActiveFilter[] = [
      {
        category: healthFilter.category,
        value: status.name
      }
    ];

    FilterSelected.setSelected({ filters: filters, op: DEFAULT_LABEL_OPERATION });
  };

  const linkAction = (status: Status, targetPage: Paths): void => {
    // Kiosk actions are used when the kiosk specifies a parent,
    // otherwise the kiosk=true will keep the links inside Kiali
    if (isParentKiosk(props.kiosk)) {
      kioskGraphAction(props.name, status.name, props.duration, props.refreshInterval, targetPage);
    } else {
      setFilters(status);
    }
  };

  const getWorstStatus = (status: NamespaceStatus): Status | null => {
    if (status.inError.length > 0) {
      return FAILURE;
    }
    if (status.inWarning.length > 0) {
      return DEGRADED;
    }
    if (status.inNotReady.length > 0) {
      return NOT_READY;
    }
    if (status.inSuccess.length > 0) {
      return HEALTHY;
    }
    if (status.notAvailable.length > 0) {
      return NA;
    }
    return null;
  };

  const buildTooltipContent = (status: NamespaceStatus): React.ReactNode => {
    const statuses: Array<{ count: number; items: string[]; status: Status }> = [];

    if (status.inError.length > 0) {
      statuses.push({ count: status.inError.length, items: status.inError, status: FAILURE });
    }
    if (status.inWarning.length > 0) {
      statuses.push({ count: status.inWarning.length, items: status.inWarning, status: DEGRADED });
    }
    if (status.inNotReady.length > 0) {
      statuses.push({ count: status.inNotReady.length, items: status.inNotReady, status: NOT_READY });
    }
    if (status.inSuccess.length > 0) {
      statuses.push({ count: status.inSuccess.length, items: status.inSuccess, status: HEALTHY });
    }
    if (status.notAvailable.length > 0) {
      statuses.push({ count: status.notAvailable.length, items: status.notAvailable, status: NA });
    }

    if (statuses.length === 0) {
      return null;
    }

    return (
      <div style={{ textAlign: 'left' }}>
        {statuses.map((s, idx) => {
          const displayItems =
            s.items.length > 6 ? s.items.slice(0, 5).concat([`and ${s.items.length - 5} more...`]) : s.items;
          return (
            <div key={idx} style={{ marginBottom: '0.25rem' }}>
              <strong>{s.status.name}</strong> ({s.count})
              {displayItems.map((item, itemIdx) => (
                <div key={itemIdx} style={{ marginLeft: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>{createIcon(s.status)}</span>
                  {item}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatus = (status: NamespaceStatus | undefined, targetPage: Paths): React.ReactNode => {
    const nbItems = status
      ? status.inError.length +
        status.inWarning.length +
        status.inSuccess.length +
        status.notAvailable.length +
        status.inNotReady.length
      : 0;

    // Don't display the line when nbItems is 0
    if (nbItems === 0) {
      return null;
    }

    const worstStatus = status ? getWorstStatus(status) : null;
    const tooltipContent = status ? buildTooltipContent(status) : null;

    let typeName: string;
    switch (targetPage) {
      case Paths.APPLICATIONS:
        typeName = t('Applications');
        break;
      case Paths.SERVICES:
        typeName = t('Services');
        break;
      case Paths.WORKLOADS:
        typeName = t('Workloads');
        break;
      default:
        typeName = '';
    }

    return (
      <div style={{ marginBottom: '0.125rem', textAlign: 'left' }}>
        {worstStatus ? (
          <Tooltip aria-label="Status details" position={TooltipPosition.auto} content={tooltipContent}>
            <div style={{ display: 'inline-block', marginRight: '0.5rem' }}>
              <Link to={`/${targetPage}?namespaces=${props.name}`} onClick={() => linkAction(worstStatus, targetPage)}>
                {createIcon(worstStatus)}
              </Link>
            </div>
          </Tooltip>
        ) : (
          <div style={{ display: 'inline-block', marginRight: '1.25rem' }}></div>
        )}
        <div style={{ display: 'inline-block' }}>{typeName}</div>
      </div>
    );
  };

  return (
    <div style={{ textAlign: 'left' }}>
      {renderStatus(props.statusApp, Paths.APPLICATIONS)}
      {renderStatus(props.statusService, Paths.SERVICES)}
      {renderStatus(props.statusWorkload, Paths.WORKLOADS)}
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  kiosk: state.globalState.kiosk,
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespaceHealthStatus = connect(mapStateToProps)(NamespaceHealthStatusComponent);
