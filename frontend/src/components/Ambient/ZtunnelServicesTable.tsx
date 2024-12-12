import * as React from 'react';
import { IRow, ISortBy, OnSort, SortByDirection, TableVariant } from '@patternfly/react-table';
import { ZtunnelEndpoint, ZtunnelService } from '../../types/IstioObjects';
import { SimpleTable } from '../Table/SimpleTable';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { t } from 'i18next';
import { SortableCompareTh } from './ZtunnelConfig';

type ZtunnelServicesProps = {
  config?: ZtunnelService[];
};

export const emtpytStyle = kialiStyle({
  padding: 0,
  margin: 0
});

const columns: SortableCompareTh<ZtunnelService>[] = [
  {
    title: t('Namespace'),
    sortable: true,
    compare: (a, b) => a.namespace.localeCompare(b.namespace)
  },
  {
    title: t('Service Name'),
    sortable: true,
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    title: t('Service VIP'),
    sortable: false
  },
  {
    title: t('Waypoint'),
    sortable: true,
    compare: (a, b) => a.waypoint.destination.localeCompare(b.waypoint.destination)
  },
  {
    title: t('Endpoints'),
    sortable: false
  }
];

export const ZtunnelServicesTable: React.FC<ZtunnelServicesProps> = (props: ZtunnelServicesProps) => {
  const [sortBy, setSortBy] = React.useState(0);
  const [sortDirection, setSortDirection] = React.useState(SortByDirection.asc);

  const getEndpoints = (endpoints: Record<string, ZtunnelEndpoint>): string => {
    let total = 0;
    let up = 0;
    Object.entries(endpoints).forEach(([_, endpoint]) => {
      total++;
      if (endpoint.status === 'Healthy') {
        up++;
      }
      return;
    });
    return `${total}/${up}`;
  };

  const compare = columns[sortBy].compare;
  const sorted = compare
    ? props.config?.sort(sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
    : props.config;

  const rows: IRow[] = sorted
    ? sorted.map(service => {
        return {
          cells: [
            service.namespace,
            service.name,
            service.vips.map(sb => {
              return sb;
            }),
            service.waypoint.destination ? (
              <>
                {service.waypoint.destination}:{service.waypoint.hboneMtlsPort}
              </>
            ) : (
              t('None')
            ),
            getEndpoints(service.endpoints)
          ]
        };
      })
    : [];

  const sort: ISortBy = { index: sortBy, direction: sortDirection };
  const onSort: OnSort = (_event: React.MouseEvent, index: number, sortDirection: SortByDirection) => {
    setSortBy(index);
    setSortDirection(sortDirection);
  };

  const noServicesConfig: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
      <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
        {t('No Ztunnel services found')}
      </EmptyStateBody>
    </EmptyState>
  );

  return (
    <SimpleTable
      label={t('Ztunnel services config')}
      columns={columns}
      rows={rows}
      variant={TableVariant.compact}
      emptyState={noServicesConfig}
      sortBy={sort}
      onSort={onSort}
    />
  );
};
