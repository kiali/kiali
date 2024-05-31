import * as React from 'react';
import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { IRow, ISortBy, SortByDirection } from '@patternfly/react-table';
import { ClusterSummary } from '../../../types/IstioObjects';
import { ActiveFilter, FILTER_ACTION_APPEND, FilterType, AllFilterTypes } from '../../../types/Filters';
import { SortField } from '../../../types/SortFilters';
import { Namespace } from '../../../types/Namespace';
import { defaultFilter, istioConfigLink, serviceLink } from '../../../helpers/EnvoyHelpers';
import { Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { isParentKiosk } from '../../Kiosk/KioskActions';
import { SortableTh } from 'components/SimpleTable';
import { t } from 'utils/I18nUtils';

export class ClusterTable implements SummaryTable {
  kiosk: string;
  namespace: string;
  namespaces: Namespace[] | undefined;
  sortingDirection: 'asc' | 'desc';
  sortingIndex: number;
  summaries: ClusterSummary[];

  constructor(summaries: ClusterSummary[], sortBy: ISortBy, namespaces: Namespace[], namespace: string, kiosk: string) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index ?? 0;
    this.sortingDirection = sortBy.direction ?? SortByDirection.asc;
    this.namespaces = namespaces;
    this.namespace = namespace;
    this.kiosk = kiosk;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        category: t('FQDN'),
        placeholder: t('FQDN'),
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: t('Port'),
        placeholder: t('Port'),
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: t('Subset'),
        placeholder: t('Subset'),
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: t('Direction'),
        placeholder: t('Direction'),
        filterType: AllFilterTypes.select,
        action: FILTER_ACTION_APPEND,
        filterValues: [
          { id: 'inbound', title: t('inbound') },
          { id: 'outbound', title: t('outbound') }
        ]
      }
    ];
  };

  filterMethods = (): { [filter_id: string]: (entry: ClusterSummary, filter: ActiveFilter) => boolean } => {
    return {
      FQDN: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return [entry.service_fqdn.service, entry.service_fqdn.namespace, entry.service_fqdn.cluster]
          .join('.')
          .includes(filter.value);
      },
      Port: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.port.toString().includes(filter.value);
      },
      Subset: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.subset.toString().includes(filter.value);
      },
      Direction: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.direction.toString().includes(filter.value);
      }
    };
  };

  sortFields = (): SortField<ClusterSummary>[] => {
    return [
      {
        id: 'fqdn',
        title: 'FQDN',
        isNumeric: false,
        param: 'fqdn',
        compare: (a, b) => {
          return [a.service_fqdn.service, a.service_fqdn.namespace, a.service_fqdn.cluster]
            .join('.')
            .localeCompare([b.service_fqdn.service, b.service_fqdn.namespace, b.service_fqdn.cluster].join('.'));
        }
      },
      {
        id: 'port',
        title: 'Port',
        isNumeric: true,
        param: 'port',
        compare: (a, b) => {
          return a.port - b.port;
        }
      },
      {
        id: 'subset',
        title: 'Subset',
        isNumeric: false,
        param: 'subset',
        compare: (a, b) => {
          return a.subset.localeCompare(b.subset);
        }
      },
      {
        id: 'direction',
        title: 'Direction',
        isNumeric: false,
        param: 'direction',
        compare: (a, b) => {
          return a.direction.localeCompare(b.direction);
        }
      },
      {
        id: 'type',
        title: 'Type',
        isNumeric: false,
        param: 'type',
        compare: (a, b) => {
          return a.type.localeCompare(b.type);
        }
      },
      {
        id: 'dr',
        title: 'Destination Rule',
        isNumeric: true,
        param: 'dr',
        compare: (a, b) => {
          return a.destination_rule.localeCompare(b.destination_rule);
        }
      }
    ];
  };

  render_cluster_type = (): React.ReactNode => {
    return (
      <ul className={kialiStyle({ textAlign: 'left' })}>
        <li>
          <b>STATIC</b>: Static is the simplest service discovery type. The configuration explicitly specifies the
          resolved network name (IP address/port, unix domain socket, etc.) of each upstream host.
        </li>
        <li>
          <b>STRICT_DNS</b>: Envoy will continuously and asynchronously resolve the specified DNS targets
        </li>
        <li>
          <b>LOGICAL_DNS</b>: Logical DNS uses a similar asynchronous resolution mechanism to strict DNS. However,
          instead of strictly taking the results of the DNS query and assuming that they comprise the entire upstream
          cluster, a logical DNS cluster only uses the first IP address returned when a new connection needs to be
          initiated
        </li>
        <li>
          <b>EDS</b>: The endpoint discovery service is a xDS management server based on gRPC or REST-JSON API server
          used by Envoy to fetch cluster members.{' '}
        </li>
        <li>
          <b>ORIGINAL_DST</b>: Original destination cluster can be used when incoming connections are redirected to
          Envoy either via an iptables REDIRECT or TPROXY target or with Proxy Protocol
        </li>
      </ul>
    );
  };

  head = (): SortableTh[] => {
    return [
      {
        title: 'Service FQDN',
        sortable: true,
        info: { tooltip: <>Fully Qualified Domain Name</> }
      },
      {
        title: 'Port',
        sortable: true
      },
      {
        title: 'Subset',
        sortable: true
      },
      {
        title: 'Direction',
        sortable: true,
        info: {
          tooltip: (
            <ul className={kialiStyle({ textAlign: 'left' })}>
              <li>
                <b>inbound</b>: The inbound cluster events are the events that come into a node. These cluster events
                come from another node and enter other nodes.
              </li>
              <li>
                <b>outbound</b>: The outbound cluster events are the events that go out of a node. These cluster events
                are produced and sent from a node to other nodes.
              </li>
            </ul>
          )
        }
      },
      {
        title: 'Type',
        sortable: true,
        info: { tooltip: this.render_cluster_type() }
      },
      {
        title: 'DestinationRule',
        sortable: true
      }
    ];
  };

  resource = (): string => 'clusters';

  setSorting = (columnIndex: number, direction: 'asc' | 'desc'): void => {
    this.sortingIndex = columnIndex;
    this.sortingDirection = direction;
  };

  sortBy = (): ISortBy => {
    return {
      index: this.sortingIndex,
      direction: this.sortingDirection ?? 'asc'
    };
  };

  tooltip = (): React.ReactNode => {
    return (
      <Tooltip
        content={
          <div className={kialiStyle({ textAlign: 'left' })}>
            Group of logically similar upstream hosts that Envoy connects to. (All the hosts that envoy manage traffic)
          </div>
        }
      >
        <KialiIcon.Help className={kialiStyle({ width: '14px', height: '14px', color: PFColors.Info })} />
      </Tooltip>
    );
  };

  rows(): IRow[] {
    const parentKiosk = isParentKiosk(this.kiosk);
    return this.summaries
      .filter((value: ClusterSummary): boolean => {
        return defaultFilter(value, this.filterMethods());
      })
      .sort((a: ClusterSummary, b: ClusterSummary): number => {
        const sortField = this.sortFields().find((value: SortField<ClusterSummary>): boolean => {
          return value.id === this.sortFields()[this.sortingIndex].id;
        });

        return this.sortingDirection === 'asc' ? sortField!.compare(a, b) : sortField!.compare(b, a);
      })
      .map(
        (value: ClusterSummary): IRow => {
          return {
            cells: [
              serviceLink(value.service_fqdn, this.namespaces, this.namespace, false, parentKiosk),
              value.port,
              value.subset,
              value.direction,
              value.type,
              istioConfigLink(value.destination_rule, 'destinationrule')
            ]
          };
        }
      );
  }
}

export const ClusterSummaryTable = SummaryTableRenderer<ClusterTable>();
