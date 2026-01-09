import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY, NA, Status } from '../../types/Health';
import { NamespaceStatus } from '../../types/NamespaceInfo';
import { Paths } from '../../config';
import { useKialiTranslation } from 'utils/I18nUtils';
import { createIcon } from '../../config/KialiIcon';

type Props = {
  name: string;
  statusApp?: NamespaceStatus;
  statusService?: NamespaceStatus;
  statusWorkload?: NamespaceStatus;
};

export const NamespaceStatusesCombined: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

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
            <div style={{ display: 'inline-block', marginRight: '1rem', cursor: 'pointer' }}>
              {createIcon(worstStatus)}
            </div>
          </Tooltip>
        ) : (
          <div style={{ display: 'inline-block', marginRight: '0.25rem' }}>N/A</div>
        )}
        <div style={{ display: 'inline-block' }}>
          {nbItems} {typeName}
        </div>
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
