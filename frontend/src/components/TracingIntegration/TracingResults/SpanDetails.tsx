import * as React from 'react';
import { Card, CardBody } from '@patternfly/react-core';

import { RichSpanData } from 'types/TracingInfo';
import { TracingUrlProvider } from 'types/Tracing';
import { SpanTable } from './SpanTable';
import { FilterSelected, StatefulFilters } from 'components/Filters/StatefulFilters';
import { spanFilters } from './Filters';
import { runFilters } from 'components/FilterList/FilterHelper';
import { ActiveFiltersInfo } from 'types/Filters';
import { TraceLabels } from './TraceLabels';

interface SpanDetailsProps {
  cluster?: string;
  externalURLProvider?: TracingUrlProvider;
  fromWaypoint: boolean;
  items: RichSpanData[];
  namespace: string;
  target: string;
  traceID: string;
  waypointServiceFilter?: string; // This is used to match the span (operationName) as this is different than the workload
}

export const SpanDetails: React.FC<SpanDetailsProps> = (props: SpanDetailsProps) => {
  const filters = spanFilters(props.items);

  const [activeFilters, setActiveFilters] = React.useState<ActiveFiltersInfo>(FilterSelected.init(filters));
  const filteredItems = runFilters(props.items, filters, activeFilters);

  return (
    <Card isCompact>
      <CardBody>
        <StatefulFilters initialFilters={filters} onFilterChange={active => setActiveFilters(active)}>
          <TraceLabels
            spans={props.items}
            filteredSpans={activeFilters.filters.length > 0 ? filteredItems : undefined}
            oneline={true}
          />
        </StatefulFilters>

        {props.traceID && (
          <SpanTable
            items={filteredItems}
            namespace={props.namespace}
            externalURLProvider={props.externalURLProvider}
            cluster={props.cluster}
            target={props.waypointServiceFilter ? props.waypointServiceFilter : props.target}
            traceID={props.traceID}
            fromWaypoint={props.fromWaypoint}
          />
        )}
      </CardBody>
    </Card>
  );
};
