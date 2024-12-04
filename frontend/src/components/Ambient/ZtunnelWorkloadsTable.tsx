import * as React from 'react';
import { IRow, TableVariant, ThProps } from '@patternfly/react-table';
import { ZtunnelWorkload } from '../../types/IstioObjects';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { emtpytStyle } from './ZtunnelServicesTable';
import { SimpleTable } from '../Table/SimpleTable';

type ZtunnelWorkloadsProps = {
  config?: ZtunnelWorkload[];
};

export const ZtunnelWorkloadsTable: React.FC<ZtunnelWorkloadsProps> = (props: ZtunnelWorkloadsProps) => {
  const rows: IRow[] = props.config
    ? props.config
        .sort((a: ZtunnelWorkload, b: ZtunnelWorkload) => {
          if ((a.name ?? '') < (b.name ?? '')) {
            return -1;
          } else if ((a.name ?? '') > (b.name ?? '')) {
            return 1;
          } else {
            return a.name < b.name ? -1 : 1;
          }
        })
        .map(workload => {
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
                'None'
              ),
              workload.protocol
            ]
          };
        })
    : [];

  const columns: ThProps[] = [
    { title: 'Namespace' },
    { title: 'Pod Name' },
    { title: 'Address' },
    { title: 'Node' },
    { title: 'Waypoint' },
    { title: 'Protocol' }
  ];
  const noWorkloadsConfig: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
      <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
        No Ztunnel workloads found
      </EmptyStateBody>
    </EmptyState>
  );

  return (
    <SimpleTable
      label="Ztunnel workloads config"
      columns={columns}
      rows={rows}
      variant={TableVariant.compact}
      emptyState={noWorkloadsConfig}
    />
  );
};
