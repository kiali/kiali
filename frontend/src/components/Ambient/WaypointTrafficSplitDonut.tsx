import * as React from 'react';
import { ChartDonut } from '@patternfly/react-charts/victory';
import { Flex, FlexItem, Tooltip } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { PFColors } from '../Pf/PfColors';
import { istioCanaryUpgradeChartColorScale } from 'utils/IstioCanaryUpgradeChart';
import { linkStyle } from '../../pages/Overview/OverviewStyles';
import { classes } from 'typestyle';
import { KialiLink } from '../Link/KialiLink';
import type { WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { isMultiCluster } from '../../config';

const waypointHref = (namespace: string, name: string, cluster?: string): string => {
  let href = `/namespaces/${namespace}/workloads/${name}`;
  if (cluster && isMultiCluster) {
    href = `${href}?clusterName=${cluster}`;
  }
  return href;
};

const chartBoxStyle = kialiStyle({
  height: '200px',
  width: '220px'
});

const legendColumnStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md,
  justifyContent: 'center'
});

const legendRowStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.xs
});

const legendLabelStyle = kialiStyle({
  fontSize: 'var(--pf-t--global--font--size--body--default)',
  fontWeight: 'var(--pf-t--global--font--weight--body--bold)'
});

const legendLinkRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.xs
});

const legendSwatchStyle = kialiStyle({
  borderRadius: '2px',
  display: 'inline-block',
  flexShrink: 0,
  height: '0.75rem',
  marginRight: PFSpacer.xs,
  width: '0.75rem'
});

type SliceDatum = {
  cluster?: string;
  role: 'canary' | 'primary';
  share: number;
  workloadName: string;
  workloadNamespace: string;
};

type Props = {
  split: WaypointTrafficSplit;
  viewingCluster?: string;
  viewingNamespace: string;
  viewingWorkload: string;
};

const isViewingWaypoint = (
  slice: SliceDatum,
  viewingWorkload: string,
  viewingNamespace: string,
  viewingCluster?: string
): boolean => {
  return (
    slice.workloadName === viewingWorkload &&
    slice.workloadNamespace === viewingNamespace &&
    (!viewingCluster || !slice.cluster || slice.cluster === viewingCluster)
  );
};

export const WaypointTrafficSplitDonut: React.FC<Props> = ({
  split,
  viewingCluster,
  viewingNamespace,
  viewingWorkload
}) => {
  const primary = split.primary;
  const canary = split.canary!;
  const [hoveredSlice, setHoveredSlice] = React.useState<number | undefined>(undefined);

  const slices: SliceDatum[] = [
    {
      cluster: primary.cluster,
      role: 'primary',
      share: split.primaryWeight,
      workloadName: primary.name,
      workloadNamespace: primary.namespace
    },
    {
      cluster: canary.cluster,
      role: 'canary',
      share: split.canaryWeight,
      workloadName: canary.name,
      workloadNamespace: canary.namespace
    }
  ];

  const height = 200;
  const width = 220;
  const hovered = hoveredSlice !== undefined ? slices[hoveredSlice] : undefined;
  const title = hovered ? `${hovered.share}%` : '';
  const subTitle = hovered ? hovered.workloadName : t('Traffic split');

  return (
    <Flex
      alignItems={{ default: 'alignItemsCenter' }}
      data-test="waypoint-traffic-split-donut"
      gap={{ default: 'gapLg' }}
      wrap="wrap"
    >
      <FlexItem>
        <div className={chartBoxStyle}>
          <ChartDonut
            colorScale={[...istioCanaryUpgradeChartColorScale]}
            constrainToVisibleArea
            data={slices}
            events={[
              {
                target: 'data',
                eventHandlers: {
                  onMouseEnter: (_, props) => {
                    setHoveredSlice(props.index);
                  },
                  onMouseLeave: () => {
                    setHoveredSlice(undefined);
                  }
                }
              }
            ]}
            height={height}
            labels={({ datum }) => `${datum.workloadName}: ${datum.share}%`}
            padding={{
              bottom: 20,
              left: 20,
              right: 20,
              top: 20
            }}
            style={{
              data: {
                opacity: ({ index }) => (hoveredSlice !== undefined && hoveredSlice !== index ? 0.35 : 1)
              }
            }}
            subTitle={subTitle}
            title={title}
            width={width}
            x="workloadName"
            y="share"
          />
        </div>
      </FlexItem>
      <FlexItem className={legendColumnStyle}>
        {slices.map(slice => {
          const isCurrent = isViewingWaypoint(slice, viewingWorkload, viewingNamespace, viewingCluster);
          return (
            <div
              className={legendRowStyle}
              data-test={slice.role === 'primary' ? 'waypoint-primary-row' : 'waypoint-canary-row'}
              key={slice.role}
            >
              <div style={{ alignItems: 'center', display: 'flex' }}>
                <span
                  aria-hidden
                  className={legendSwatchStyle}
                  style={{
                    backgroundColor: istioCanaryUpgradeChartColorScale[slice.role === 'primary' ? 0 : 1]
                  }}
                />
                <span className={legendLabelStyle}>
                  {slice.role === 'primary' ? t('Primary waypoint') : t('Canary waypoint')}
                  {` (${slice.share}%)`}
                </span>
              </div>
              <div className={legendLinkRowStyle}>
                {isCurrent && (
                  <Tooltip content={t('This waypoint')}>
                    <span aria-label={t('This waypoint')} data-test="waypoint-traffic-split-viewing-marker">
                      <KialiIcon.Star color={PFColors.Gold400} />
                    </span>
                  </Tooltip>
                )}
                <KialiLink
                  className={classes(linkStyle)}
                  to={waypointHref(slice.workloadNamespace, slice.workloadName, slice.cluster)}
                >
                  {slice.workloadName}
                </KialiLink>
              </div>
            </div>
          );
        })}
      </FlexItem>
    </Flex>
  );
};
