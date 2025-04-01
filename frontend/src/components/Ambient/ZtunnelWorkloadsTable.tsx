import * as React from 'react';
import { IRow, ISortBy, OnSort, SortByDirection, TableVariant } from '@patternfly/react-table';
import { ZtunnelWorkload } from '../../types/IstioObjects';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { emtpytStyle } from './ZtunnelServicesTable';
import { SimpleTable } from '../Table/SimpleTable';
import { t } from 'i18next';
import { SortableCompareTh, stickyThead, yoverflow } from './ZtunnelConfig';

type ZtunnelWorkloadsProps = {
  config?: ZtunnelWorkload[];
};

const columns: SortableCompareTh<ZtunnelWorkload>[] = [
  {
    title: t('Namespace'),
    sortable: true,
    compare: (a, b) => a.namespace.localeCompare(b.namespace)
  },
  {
    title: t('Pod Name'),
    sortable: true,
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    title: t('Address'),
    sortable: false
  },
  {
    title: t('Node'),
    sortable: true,
    compare: (a, b) => a.node.localeCompare(b.node)
  },
  {
    title: t('Waypoint'),
    sortable: false
  },
  {
    title: t('Protocol'),
    sortable: false
  }
];

export const ZtunnelWorkloadsTable: React.FC<ZtunnelWorkloadsProps> = (props: ZtunnelWorkloadsProps) => {
  const [sortBy, setSortBy] = React.useState(0);
  const [sortDirection, setSortDirection] = React.useState(SortByDirection.asc);

  const compare = columns[sortBy].compare;
  const sorted = compare
    ? props.config?.sort(sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
    : props.config;

  const sort: ISortBy = { index: sortBy, direction: sortDirection };
  const onSort: OnSort = (_event: React.MouseEvent, index: number, sortDirection: SortByDirection) => {
    setSortBy(index);
    setSortDirection(sortDirection);
  };

  const rows: IRow[] = sorted
    ? sorted.map(workload => {
        return {
          cells: [
            workload.namespace,
            workload.name,
            workload.workloadIps.map(ip => {
              return ip;
            }),
            workload.node,
            workload.waypoint ? (
              <>
                {workload.waypoint.destination}:{workload.waypoint.hboneMtlsPort}
              </>
            ) : (
              t('None')
            ),
            workload.protocol
          ]
        };
      })
    : [];

  const noWorkloadsConfig: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
      <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
        {t('No Ztunnel workloads found')}
      </EmptyStateBody>
    </EmptyState>
  );

  return (
    <div className={yoverflow}>
      <SimpleTable
        label={t('Ztunnel workloads config')}
        columns={columns}
        rows={rows}
        variant={TableVariant.compact}
        emptyState={noWorkloadsConfig}
        sortBy={sort}
        onSort={onSort}
        theadStyle={stickyThead}
      />
    </div>
  );
};
