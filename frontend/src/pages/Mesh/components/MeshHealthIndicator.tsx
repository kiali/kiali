import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Status } from 'types/Health';
import { Paths } from 'config';
import { ActiveFilter, DEFAULT_LABEL_OPERATION } from 'types/Filters';
import { healthFilter } from 'components/Filters/CommonFilters';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { healthIndicatorStyle } from 'styles/HealthStyle';
import { createIcon } from 'config/KialiIcon';
import { KialiLink } from 'components/Link/KialiLink';

type Props = {
  id: string;
  items: string[];
  namespace: string;
  status: Status;
  targetPage: Paths;
};

export const MeshHealthIndicator: React.FC<Props> = (props: Props) => {
  const setFilters = (): void => {
    const filters: ActiveFilter[] = [
      {
        category: healthFilter.category,
        value: props.status.name
      }
    ];

    FilterSelected.setSelected({ filters: filters, op: DEFAULT_LABEL_OPERATION });
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
      aria-label={'Health indicator'}
      position={TooltipPosition.auto}
      content={tooltipContent}
      className={healthIndicatorStyle}
    >
      <div style={{ display: 'inline-block', marginRight: '0.375rem' }}>
        <KialiLink to={`/${props.targetPage}?namespaces=${props.namespace}`} onClick={setFilters}>
          {createIcon(props.status)}
          {` ${length}`}
        </KialiLink>
      </div>
    </Tooltip>
  );
};
