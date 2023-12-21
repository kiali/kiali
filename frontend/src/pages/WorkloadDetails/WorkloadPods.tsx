import * as React from 'react';
import { ObjectValidation, Pod } from '../../types/IstioObjects';
import { cellWidth, ICell, IRow, TableVariant } from '@patternfly/react-table';
import { Table, TableBody, TableHeader } from '@patternfly/react-table/deprecated';
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
import { tableStyle } from 'styles/TableStyle';

type WorkloadPodsProps = {
  namespace: string;
  workload: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
};

const emptyStyle = kialiStyle({
  padding: 0,
  margin: 0
});

const resourceListStyle = kialiStyle({
  margin: '0px 0 11px 0',
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const infoStyle = kialiStyle({
  margin: '0px 5px 2px 10px',
  verticalAlign: '-4px !important'
});

const iconStyle = kialiStyle({
  display: 'inline-block',
  verticalAlign: '2px !important'
});

export class WorkloadPods extends React.Component<WorkloadPodsProps> {
  columns(): ICell[] {
    return [{ title: $t('Name') }, { title: $t('Status'), transforms: [cellWidth(10) as any] }];
  }

  noPods(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
                <EmptyStateBody className={emptyStyle}>
                  {$t('errorMsg.NoPods', 'No Pods in workload')} {this.props.workload}
                </EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 2 }
          }
        ]
      }
    ];
  }

  rows(): IRow[] {
    if ((this.props.pods || []).length === 0) {
      return this.noPods();
    }

    let rows: IRow[] = [];
    (this.props.pods || [])
      .sort((p1: Pod, p2: Pod) => (p1.name < p2.name ? -1 : 1))
      .map((pod, _podIdx) => {
        let validation: ObjectValidation = {} as ObjectValidation;
        if (this.props.validations[pod.name]) {
          validation = this.props.validations[pod.name];
        }
        const podProperties = (
          <div key="properties-list" className={resourceListStyle}>
            <ul style={{ listStyleType: 'none' }}>
              <li>
                <span>{$t('Created')}</span>
                <div style={{ display: 'inline-block' }}>
                  <LocalTime time={pod.createdAt} />
                </div>
              </li>
              <li>
                <span>{$t('CreatedBy', 'Created By')}</span>
                <div style={{ display: 'inline-block' }}>
                  {pod.createdBy && pod.createdBy.length > 0
                    ? pod.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')
                    : $t('NotFound', 'Not found')}
                </div>
              </li>
              <li>
                <span>{$t('ServiceAccount', 'Service Account')}</span>
                <div style={{ display: 'inline-block' }}>{pod.serviceAccountName || $t('NotFound', 'Not found')}</div>
              </li>
              <li>
                <span>{$t('Istio.IstioInitContainer', 'Istio Init Container')}</span>
                <div style={{ display: 'inline-block' }}>
                  {pod.istioInitContainers
                    ? pod.istioInitContainers.map(c => `${c.image}`).join(', ')
                    : $t('NotFound', 'Not found')}
                </div>
              </li>
              <li>
                <span>{$t('Istio.IstioContainer', 'Istio Container')}</span>
                <div style={{ display: 'inline-block' }}>
                  {pod.istioContainers
                    ? pod.istioContainers.map(c => `${c.image}`).join(', ')
                    : $t('NotFound', 'Not found')}
                </div>
              </li>
              <li>
                <span>{$t('Labels')}</span>
                <div style={{ display: 'inline-block' }}>
                  <Labels labels={pod.labels} expanded={true} />
                </div>
              </li>
            </ul>
          </div>
        );

        rows.push({
          cells: [
            {
              title: (
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
                </span>
              )
            },
            {
              title: (
                <>
                  <PodStatus proxyStatus={pod.proxyStatus} checks={validation.checks} />
                </>
              )
            }
          ]
        });
        return rows;
      });

    return rows;
  }

  render() {
    return (
      <Card isCompact={true} id={'WorkloadPodsCard'}>
        <CardHeader>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            Pods
          </Title>
        </CardHeader>
        <CardBody>
          <Table
            variant={TableVariant.compact}
            aria-label={'list_workloads_pods'}
            cells={this.columns()}
            rows={this.rows()}
            className={tableStyle}
          >
            <TableHeader />
            <TableBody />
          </Table>
        </CardBody>
      </Card>
    );
  }
}
