import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { Label } from '../Label/Label';
import { getFiltersFromURL } from '../FilterList/FilterHelper';
import { appLabelFilter, versionLabelFilter } from '../../pages/WorkloadList/FiltersAndSorts';
import type { ActiveFilter } from '../../types/Filters';
import type { StatefulFiltersRef } from '../Filters/StatefulFilters';
import { labelFilter } from '../Filters/CommonFilters';
import { labelFilter as NsLabelFilter } from '../../pages/Namespaces/Filters';
import { getPagePath } from 'utils/NavigationUtils';
import { partitionByIstio } from '../../pages/PageUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type ListLabelsProps = {
  labels?: Record<string, string>;
  statefulFilter?: StatefulFiltersRef;
};

const INITIAL_LABEL_COUNT = 2;

const labelsStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap'
});

const labelActivate = (filters: ActiveFilter[], key: string, value: string, id: string): boolean => {
  return filters.some(filter => {
    if (filter.category === id) {
      if (filter.value.includes('=')) {
        const [k, v] = filter.value.split('=');

        if (k === key) {
          return v.split(',').some(val => value.split(',').some(vl => vl.trim().startsWith(val.trim())));
        }

        return false;
      }

      return key === filter.value;
    } else {
      if (filter.category === appLabelFilter.category) {
        return filter.value === 'Present' && key === 'app';
      }

      return filter.value === 'Present' && key === 'version';
    }
  });
};

export const ListLabels: React.FC<ListLabelsProps> = ({ labels, statefulFilter }) => {
  const [expanded, setExpanded] = React.useState(false);
  const { sorted: entries } = partitionByIstio(labels ?? {});
  const hiddenCount = Math.max(entries.length - INITIAL_LABEL_COUNT, 0);
  // Select entries before creating chips so collapsed labels have no component or tooltip overhead.
  const visibleEntries = expanded ? entries : entries.slice(0, INITIAL_LABEL_COUNT);
  const labelFilt = getPagePath() === 'namespaces' ? NsLabelFilter : labelFilter;
  const filters = getFiltersFromURL([labelFilt, appLabelFilter, versionLabelFilter]);
  const labelFilters = filters.filters.filter(filter => filter.category === labelFilt.category);

  return (
    <div className={labelsStyle}>
      {visibleEntries.map(([key, value]) => {
        const label = `${key}=${value}`;
        const labelAct = labelActivate(filters.filters, key, value, labelFilt.category);
        const isExactlyLabelFilter = labelFilters.some(filter => filter.value.includes(label));
        return (
          <Label
            key={key}
            name={key}
            value={value}
            color={labelAct ? 'yellow' : undefined}
            style={{ cursor: isExactlyLabelFilter || !labelAct ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
            onClick={(): void => {
              if (statefulFilter?.current) {
                if (labelAct) {
                  if (isExactlyLabelFilter) {
                    statefulFilter.current.removeFilter(labelFilt.category, label);
                  }
                } else {
                  statefulFilter.current.filterAdded(labelFilt, label);
                }
              }
            }}
          />
        );
      })}

      {hiddenCount > 0 && (
        <Button
          variant="link"
          isInline
          aria-expanded={expanded}
          data-test="toggle-labels"
          onClick={() => setExpanded(previous => !previous)}
        >
          {expanded ? t('Show less') : t('{{count}} more', { count: hiddenCount })}
        </Button>
      )}
    </div>
  );
};
