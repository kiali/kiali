import * as React from 'react';
import { IRow, TableVariant, ThProps } from '@patternfly/react-table';
import { ZtunnelEndpoint, ZtunnelService } from '../../types/IstioObjects';
import { SimpleTable } from '../Table/SimpleTable';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';

type ZtunnelServicesProps = {
  config?: ZtunnelService[];
};

export const emtpytStyle = kialiStyle({
  padding: 0,
  margin: 0
});

export const ZtunnelServicesTable: React.FC<ZtunnelServicesProps> = (props: ZtunnelServicesProps) => {
  const getEndpoints = (endpoints: Record<string, ZtunnelEndpoint>): string => {
    let total = 0;
    let up = 0;
    Object.entries(endpoints).map(([_, endpoint]) => {
      total++;
      if (endpoint.status === 'Healthy') {
        up++;
      }
    });
    return `${total}/${up}`;
  };

  const rows: IRow[] = props.config
    ? props.config
        .sort((a: ZtunnelService, b: ZtunnelService) => {
          if ((a.name ?? '') < (b.name ?? '')) {
            return -1;
          } else if ((a.name ?? '') > (b.name ?? '')) {
            return 1;
          } else {
            return a.name < b.name ? -1 : 1;
          }
        })
        .map(service => {
          return {
            cells: [
              service.namespace,
              service.name,
              service.vips.map(sb => {
                return sb.toString();
              }),
              service.waypoint.destination ? (
                <>
                  {service.waypoint.destination}:{service.waypoint.hboneMtlsPort}
                </>
              ) : (
                'None'
              ),
              getEndpoints(service.endpoints)
            ]
          };
        })
    : [];

  const columns: ThProps[] = [
    { title: 'Namespace' },
    { title: 'Service Name' },
    { title: 'Service VIP' },
    { title: 'Waypoint' },
    { title: 'Endpoints' }
  ];
  const noServicesConfig: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
      <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
        No Ztunnel services found
      </EmptyStateBody>
    </EmptyState>
  );

  return (
    <SimpleTable
      label="Ztunnel services config"
      columns={columns}
      rows={rows}
      variant={TableVariant.compact}
      emptyState={noServicesConfig}
    />
  );
};
