import * as React from 'react';
import { ObjectValidation, Pod } from '../../types/IstioObjects';
import { IRow, TableVariant, ThProps } from '@patternfly/react-table';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { PodStatus } from './PodStatus';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { LocalTime } from '../../components/Time/LocalTime';
import { Labels } from '../../components/Label/Labels';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { SimpleTable } from 'components/SimpleTable';

type WorkloadPodsProps = {
  namespace: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
  workload: string;
};

const emptyStyle = kialiStyle({
  padding: 0,
  margin: 0
});

const resourceListStyle = kialiStyle({
  margin: '0 0 0.5rem 0',
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const iconStyle = kialiStyle({
  display: 'inline-block'
});

export const WorkloadPods: React.FC<WorkloadPodsProps> = (props: WorkloadPodsProps) => {
  const columns: ThProps[] = [{ title: 'Name' }, { title: 'Status', width: 10 }];

  const noPods: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
      <EmptyStateBody className={emptyStyle}>No Pods in workload {props.workload}</EmptyStateBody>
    </EmptyState>
  );

  const rows: IRow[] = props.pods
    .sort((p1: Pod, p2: Pod) => (p1.name < p2.name ? -1 : 1))
    .map((pod, _podIdx) => {
      let validation: ObjectValidation = {} as ObjectValidation;

      if (props.validations[pod.name]) {
        validation = props.validations[pod.name];
      }

      const podProperties = (
        <div key="properties-list" className={resourceListStyle}>
          <ul style={{ listStyleType: 'none' }}>
            <li>
              <span>Created</span>
              <div style={{ display: 'inline-block' }}>
                <LocalTime time={pod.createdAt} />
              </div>
            </li>

            <li>
              <span>Created By</span>
              <div style={{ display: 'inline-block' }}>
                {pod.createdBy && pod.createdBy.length > 0
                  ? pod.createdBy.map(ref => `${ref.name} (${ref.kind})`).join(', ')
                  : 'Not found'}
              </div>
            </li>

            <li>
              <span>Service Account</span>
              <div style={{ display: 'inline-block' }}>{pod.serviceAccountName ?? 'Not found'}</div>
            </li>

            <li>
              <span>Istio Init Container</span>
              <div style={{ display: 'inline-block' }}>
                {pod.istioInitContainers ? pod.istioInitContainers.map(c => `${c.image}`).join(', ') : 'Not found'}
              </div>
            </li>

            <li>
              <span>Istio Container</span>
              <div style={{ display: 'inline-block' }}>
                {pod.istioContainers ? pod.istioContainers.map(c => `${c.image}`).join(', ') : 'Not found'}
              </div>
            </li>

            <li>
              <span>Labels</span>
              <div style={{ display: 'inline-block' }}>
                <Labels labels={pod.labels} expanded={true} />
              </div>
            </li>
          </ul>
        </div>
      );

      return {
        cells: [
          <span>
            <div key="service-icon" className={iconStyle}>
              <PFBadge badge={PFBadges.Pod} size="sm" position={TooltipPosition.top} />
            </div>

            {pod.name}

            <Tooltip
              position={TooltipPosition.right}
              content={<div style={{ textAlign: 'left' }}>{podProperties}</div>}
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </span>,

          <PodStatus proxyStatus={pod.proxyStatus} checks={validation.checks} />
        ]
      };
    });

  return (
    <Card isCompact={true} id="WorkloadPodsCard">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          Pods
        </Title>
      </CardHeader>

      <CardBody>
        <SimpleTable
          label="Workload Pod List"
          columns={columns}
          rows={rows}
          variant={TableVariant.compact}
          emptyState={noPods}
        />
      </CardBody>
    </Card>
  );
};
