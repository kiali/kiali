import * as React from 'react';
import { IRow, ISortBy, OnSort, SortByDirection, TableVariant } from '@patternfly/react-table';
import { SimpleTable } from '../Table/SimpleTable';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { t } from 'i18next';
import { SortableCompareTh } from './ZtunnelConfig';
import { Workload } from '../../types/Workload';
import { isMultiCluster } from '../../config';
import { Link } from 'react-router-dom-v5-compat';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { WaypointType } from './WaypointConfig';

type WaypointWorkloadsProps = {
  type: string;
  workloads: Workload[];
};

export const emptyStyle = kialiStyle({
  padding: 0,
  margin: 0
});

const iconStyle = kialiStyle({
  margin: 0,
  padding: 0,
  display: 'inline-block'
});

const itemStyle = kialiStyle({
  paddingBottom: '0.25rem',
  listStyle: 'none'
});

const columns: SortableCompareTh<Workload>[] = [
  {
    title: t('Name'),
    sortable: true,
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    title: t('namespace'),
    sortable: true,
    compare: (a, b) => a.namespace.localeCompare(b.namespace)
  }
];

export const WaypointWorkloadsTable: React.FC<WaypointWorkloadsProps> = (props: WaypointWorkloadsProps) => {
  const [sortBy, setSortBy] = React.useState(0);
  const [sortDirection, setSortDirection] = React.useState(SortByDirection.asc);

  const compare = columns[sortBy].compare;
  // @ts-ignore
  const sorted =
    props.workloads && props.workloads.length > 0
      ? props.workloads.sort(sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
      : [];

  const renderItem = (namespace, name, type: string, cluster?: string): React.ReactNode => {
    let href = `/namespaces/${namespace}/${type}s/${name}`;

    if (cluster && isMultiCluster) {
      href = `${href}?clusterName=${cluster}`;
    }

    const link = <Link to={href}>{name}</Link>;

    const badgeType = type === WaypointType.Service ? PFBadges.Service : PFBadges.Workload;
    return (
      <li key={`${type}_${name}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={badgeType} position={TooltipPosition.top} />
        </div>

        <span>{link}</span>
      </li>
    );
  };

  const rows: IRow[] = sorted
    ? sorted.map(workload => {
        return {
          cells: [renderItem(workload.namespace, workload.name, props.type, workload.cluster), workload.namespace]
        };
      })
    : [];

  const sort: ISortBy = { index: sortBy, direction: sortDirection };
  const onSort: OnSort = (_event: React.MouseEvent, index: number, sortDirection: SortByDirection) => {
    setSortBy(index);
    setSortDirection(sortDirection);
  };

  const noWorkloads: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
      <EmptyStateBody className={emptyStyle} data-test="istio-config-empty">
        {props.type === WaypointType.Service ? t('No enrolled services found') : t('No enrolled workloads found')}
      </EmptyStateBody>
    </EmptyState>
  );

  return (
    <>
      <div>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          List of enrolled {props.type}s
        </Title>
      </div>
      <SimpleTable
        label={`${props.type} ${t('config')}`}
        columns={columns}
        rows={rows}
        variant={TableVariant.compact}
        emptyState={noWorkloads}
        sortBy={sort}
        onSort={onSort}
      />
    </>
  );
};
