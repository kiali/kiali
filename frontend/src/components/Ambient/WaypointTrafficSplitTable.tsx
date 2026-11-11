// Assisted-by: Codex
import * as React from 'react';
import { SortByDirection, Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { OnSort } from '@patternfly/react-table';
import { Tooltip } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { PFColors } from '../Pf/PfColors';
import { istioCanaryUpgradeChartColorScale } from 'utils/IstioCanaryUpgradeChart';
import { PFSpacer } from 'styles/PfSpacer';
import { linkStyle } from '../../pages/Overview/OverviewStyles';
import { classes } from 'typestyle';
import { KialiLink } from '../Link/KialiLink';
import type { GatewayWaypointTrafficSplitConfig, WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { isMultiCluster } from '../../config';
import {
  buildWaypointTrafficSplitSlices,
  isViewingWaypointSlice,
  type WaypointTrafficSplitSlice
} from 'utils/WaypointTrafficUtils';
import { gatewayConfigsWithCanary } from './WaypointTrafficSplitSelector';
import { WaypointTrafficSplitDonut } from './WaypointTrafficSplitDonut';

const waypointHref = (namespace: string, name: string, cluster?: string): string => {
  let href = `/namespaces/${namespace}/workloads/${name}`;
  if (cluster && isMultiCluster) {
    href = `${href}?clusterName=${cluster}`;
  }
  return href;
};

const roleSwatchStyle = kialiStyle({
  borderRadius: '2px',
  display: 'inline-block',
  flexShrink: 0,
  height: '0.75rem',
  marginRight: PFSpacer.xs,
  width: '0.75rem'
});

const roleCellStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

const mergedCellStyle = kialiStyle({
  verticalAlign: 'middle'
});

const donutCellStyle = kialiStyle({
  textAlign: 'center',
  verticalAlign: 'middle'
});

const tableContainerStyle = kialiStyle({
  minWidth: 0
});

const tableStyle = kialiStyle({
  tableLayout: 'fixed',
  width: '100%'
});

const truncateTextStyle = kialiStyle({
  display: 'inline-block',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
});

const nameCellWrapStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.xs,
  maxWidth: '100%',
  minWidth: 0
});

const truncatedLinkStyle = kialiStyle({
  display: 'block',
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
});

const viewingMarkerStyle = kialiStyle({
  flexShrink: 0
});

const TruncatedText: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip content={text}>
    <span className={truncateTextStyle}>{text}</span>
  </Tooltip>
);

type Props = {
  configs?: GatewayWaypointTrafficSplitConfig[];
  showDonut?: boolean;
  split?: WaypointTrafficSplit;
  viewingCluster?: string;
  viewingNamespace: string;
  viewingWorkload: string;
};

type SplitBlock = {
  slices: WaypointTrafficSplitSlice[];
  split: WaypointTrafficSplit;
};

type NamespaceGroup = {
  blocks: SplitBlock[];
  namespace: string;
};

type RenderRow = {
  donut?: React.ReactNode;
  donutRowSpan?: number;
  key: string;
  name: React.ReactNode;
  namespace?: string;
  namespaceRowSpan?: number;
  roleWithShare: React.ReactNode;
};

const renderNameCell = (
  slice: WaypointTrafficSplitSlice,
  viewingWorkload: string,
  viewingNamespace: string,
  viewingCluster?: string
): React.ReactNode => {
  const isCurrent = isViewingWaypointSlice(slice, viewingWorkload, viewingNamespace, viewingCluster);
  return (
    <div
      className={nameCellWrapStyle}
      data-test={slice.role === 'primary' ? 'waypoint-primary-row' : 'waypoint-canary-row'}
    >
      {isCurrent && (
        <Tooltip content={t('This waypoint')}>
          <span
            aria-label={t('This waypoint')}
            className={viewingMarkerStyle}
            data-test="waypoint-traffic-split-viewing-marker"
          >
            <KialiIcon.Star color={PFColors.Gold400} />
          </span>
        </Tooltip>
      )}
      <Tooltip content={slice.workloadName}>
        <KialiLink
          className={classes(linkStyle, truncatedLinkStyle)}
          to={waypointHref(slice.workloadNamespace, slice.workloadName, slice.cluster)}
        >
          {slice.workloadName}
        </KialiLink>
      </Tooltip>
    </div>
  );
};

const renderRoleWithShareCell = (slice: WaypointTrafficSplitSlice): React.ReactNode => (
  <span className={roleCellStyle}>
    <span
      aria-hidden
      className={roleSwatchStyle}
      style={{
        backgroundColor: istioCanaryUpgradeChartColorScale[slice.role === 'primary' ? 0 : 1]
      }}
    />
    {`${slice.role} (${slice.share}%)`}
  </span>
);

const groupConfigsByNamespace = (withCanary: GatewayWaypointTrafficSplitConfig[]): NamespaceGroup[] => {
  const sorted = [...withCanary].sort((a, b) => (a.namespace || '').localeCompare(b.namespace || ''));
  const groups: NamespaceGroup[] = [];
  for (const cfg of sorted) {
    if (!cfg.split?.canary) {
      continue;
    }
    const ns = cfg.namespace || '';
    const last = groups[groups.length - 1];
    const block: SplitBlock = {
      slices: buildWaypointTrafficSplitSlices(cfg.split),
      split: cfg.split
    };
    if (last && last.namespace === ns) {
      last.blocks.push(block);
    } else {
      groups.push({ blocks: [block], namespace: ns });
    }
  }
  return groups;
};

const buildRenderRows = (
  groups: NamespaceGroup[],
  showDonut: boolean,
  viewingWorkload: string,
  viewingNamespace: string,
  viewingCluster?: string
): RenderRow[] => {
  const rows: RenderRow[] = [];

  groups.forEach(group => {
    const totalGroupRows = group.blocks.reduce((sum, block) => sum + block.slices.length, 0);
    let groupRowIndex = 0;

    group.blocks.forEach((block, blockIndex) => {
      block.slices.forEach((slice, sliceIndex) => {
        const isFirstInGroup = groupRowIndex === 0;
        const isFirstInBlock = sliceIndex === 0;
        const rowKey = `${group.namespace}-${blockIndex}-${slice.role}-${slice.workloadName}`;
        rows.push({
          donut: showDonut && isFirstInBlock ? <WaypointTrafficSplitDonut compact split={block.split} /> : undefined,
          donutRowSpan: showDonut && isFirstInBlock ? block.slices.length : undefined,
          key: rowKey,
          name: renderNameCell(slice, viewingWorkload, viewingNamespace, viewingCluster),
          namespace: isFirstInGroup ? group.namespace : undefined,
          namespaceRowSpan: isFirstInGroup ? totalGroupRows : undefined,
          roleWithShare: renderRoleWithShareCell(slice)
        });
        groupRowIndex += 1;
      });
    });
  });

  return rows;
};

export const WaypointTrafficSplitTable: React.FC<Props> = ({
  configs,
  showDonut = true,
  split,
  viewingCluster,
  viewingNamespace,
  viewingWorkload
}) => {
  const [sortDirection, setSortDirection] = React.useState(SortByDirection.asc);
  const onSort: OnSort = (_event, _index, direction) => setSortDirection(direction);

  const withCanary = React.useMemo(() => {
    if (configs) {
      return gatewayConfigsWithCanary(configs);
    }
    return split?.canary ? [{ configLevel: split.configLevel ?? '', namespace: '', split }] : [];
  }, [configs, split]);

  const groups = groupConfigsByNamespace(withCanary);
  if (sortDirection === SortByDirection.desc) {
    groups.reverse();
  }
  const rows = buildRenderRows(groups, showDonut, viewingWorkload, viewingNamespace, viewingCluster);

  if (rows.length === 0) {
    return null;
  }

  const namespaceTitle = t('Namespace');
  const nameTitle = t('Name');
  const roleTitle = t('Role');
  const percentageTitle = t('Percentage');

  return (
    <div className={tableContainerStyle} data-test="waypoint-traffic-split-table">
      <Table aria-label={t('Traffic split')} className={tableStyle} variant={TableVariant.compact}>
        <Thead>
          <Tr>
            <Th sort={{ columnIndex: 0, onSort, sortBy: { direction: sortDirection, index: 0 } }} width={30}>
              {namespaceTitle}
            </Th>
            <Th width={35}>{nameTitle}</Th>
            <Th width={20}>{roleTitle}</Th>
            {showDonut && <Th width={15}>{percentageTitle}</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(row => (
            <Tr key={row.key}>
              {row.namespace !== undefined && (
                <Td className={mergedCellStyle} dataLabel={namespaceTitle} rowSpan={row.namespaceRowSpan}>
                  <TruncatedText text={row.namespace} />
                </Td>
              )}
              <Td dataLabel={nameTitle}>{row.name}</Td>
              <Td dataLabel={roleTitle}>{row.roleWithShare}</Td>
              {showDonut && row.donut !== undefined && (
                <Td className={donutCellStyle} dataLabel={percentageTitle} rowSpan={row.donutRowSpan}>
                  {row.donut}
                </Td>
              )}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
};
