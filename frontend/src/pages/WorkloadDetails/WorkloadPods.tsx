import * as React from 'react';
import { ObjectValidation, Pod } from '../../types/IstioObjects';
import { Table, Tbody, Thead, Tr, Th, Td, TableVariant } from '@patternfly/react-table';
import {
  Bullseye,
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

type WorkloadPodsProps = {
  namespace: string;
  workload: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
};

const emptyStyle = kialiStyle({
  padding: '0 0 0 0',
  margin: '0 0 0 0'
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
  getPodProperties = (pod: Pod) => {
    return (
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
                ? pod.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')
                : 'Not found'}
            </div>
          </li>
          <li>
            <span>Service Account</span>
            <div style={{ display: 'inline-block' }}>{pod.serviceAccountName || 'Not found'}</div>
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
  };

  render() {
    return (
      <Card isCompact={true} id={'WorkloadPodsCard'}>
        <CardHeader>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            Pods
          </Title>
        </CardHeader>
        <CardBody>
          <Table variant={TableVariant.compact} aria-label={'list_workloads_pods'} className="table">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th width={10}>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(this.props.pods || [])
                .sort((p1: Pod, p2: Pod) => (p1.name < p2.name ? -1 : 1))
                .map((pod, _podIdx) => (
                  <Tr key={`workloadPod${_podIdx}`}>
                    <Td>
                      <span>
                        <div key="service-icon" className={iconStyle}>
                          <PFBadge badge={PFBadges.Pod} size="sm" position={TooltipPosition.top} />
                        </div>
                        {pod.name}
                        <Tooltip
                          position={TooltipPosition.right}
                          content={<div style={{ textAlign: 'left' }}>{this.getPodProperties(pod)}</div>}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      </span>
                    </Td>
                    <Td>
                      <PodStatus proxyStatus={pod.proxyStatus} checks={this.props.validations[pod.name].checks} />
                    </Td>
                  </Tr>
                ))}
              {(this.props.pods || []).length === 0 && (
                <Bullseye>
                  <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
                    <EmptyStateBody className={emptyStyle}>No Pods in workload {this.props.workload}</EmptyStateBody>
                  </EmptyState>
                </Bullseye>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    );
  }
}
