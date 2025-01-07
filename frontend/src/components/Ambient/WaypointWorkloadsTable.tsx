import * as React from 'react';
import { IRow, ISortBy, OnSort, SortByDirection, TableVariant } from '@patternfly/react-table';
import { SimpleTable } from '../Table/SimpleTable';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { t } from 'i18next';
import { SortableCompareTh } from './ZtunnelConfig';
import { ElementInfo, WorkloadInfo } from '../../types/Workload';
import { isMultiCluster } from '../../config';
import { Link } from 'react-router-dom-v5-compat';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { WaypointType } from '../../types/Ambient';
import { KialiIcon } from '../../config/KialiIcon';
import { infoStyle } from '../../styles/IconStyle';

type WaypointWorkloadsProps = {
  type: string;
  workloads: ElementInfo[];
};

const emptyStyle = kialiStyle({
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

const labeledBy = (
  <Tooltip
    key="tooltip_waypoint_workloads"
    position={TooltipPosition.right}
    content={
      <div style={{ textAlign: 'left' }}>
        <div>
          Indicates workloads/services with the <Label>istio.io/use-waypoint</Label> label for this waypoint. The
          'Labeled by' column indicates the source of the label—whether it comes from the namespace, service, or
          workload. In cases where multiple labels exist, it shows which one takes precedence.
        </div>
      </div>
    }
  >
    <>
      <KialiIcon.Info className={infoStyle} />
    </>
  </Tooltip>
);

const columns: SortableCompareTh<WorkloadInfo>[] = [
  {
    title: t('Name'),
    sortable: true,
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    title: t('namespace'),
    sortable: true,
    compare: (a, b) => a.namespace.localeCompare(b.namespace)
  },
  {
    title: t('Labeled by'),
    sortable: false
  }
];

export const WaypointWorkloadsTable: React.FC<WaypointWorkloadsProps> = (props: WaypointWorkloadsProps) => {
  const [sortBy, setSortBy] = React.useState(0);
  const [sortDirection, setSortDirection] = React.useState(SortByDirection.asc);

  const compare = columns[sortBy].compare;
  const sorted = compare
    ? props.workloads?.sort(sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
    : props.workloads;

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
    ? sorted.map(element => {
        return {
          cells: [
            renderItem(element.namespace, element.name, props.type, element.cluster),
            element.namespace,
            element.labelType
          ]
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
          {t('List of enrolled')} {props.type}s {labeledBy}
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
