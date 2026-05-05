import * as React from 'react';
import { ObjectValidation, Pod } from '../../types/IstioObjects';
import { IRow, ISortBy, SortByDirection, TableVariant } from '@patternfly/react-table';
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Popover,
  PopoverPosition,
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
import { SimpleTable, SortableTh } from 'components/Table/SimpleTable';
import { infoStyle } from 'styles/IconStyle';
import { serverConfig } from '../../config';

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

const podPopoverStyle = kialiStyle({
  maxWidth: '25rem',
  $nest: {
    '& .pf-v6-c-description-list__group': {
      rowGap: 0
    },
    '& .pf-v6-c-description-list': {
      rowGap: '0.25rem'
    }
  }
});

const fixedTableStyle = kialiStyle({
  tableLayout: 'fixed',
  width: '100%'
});

const nameCellStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  minWidth: 0
});

const podNameStyle = kialiStyle({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0
});

export const WorkloadPods: React.FC<WorkloadPodsProps> = (props: WorkloadPodsProps) => {
  const [sortIndex, setSortIndex] = React.useState<number>(0);
  const [sortDirection, setSortDirection] = React.useState<SortByDirection>(SortByDirection.asc);

  const columns: SortableTh[] = [
    { title: 'Name', width: 50, sortable: true },
    { title: 'Revision', width: 30, sortable: true },
    { title: 'Health', width: 20, sortable: true }
  ];

  const sort: ISortBy = { index: sortIndex, direction: sortDirection };
  const onSort = (_event: React.MouseEvent, index: number, direction: SortByDirection): void => {
    setSortIndex(index);
    setSortDirection(direction);
  };

  const noPods: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
      <EmptyStateBody className={emptyStyle}>No Pods in workload {props.workload}</EmptyStateBody>
    </EmptyState>
  );

  const sortedPods = [...props.pods].sort((a, b) => {
    const columnKeys = ['name', 'revision', 'status'];
    const key = columnKeys[sortIndex];

    const aValue = key === 'revision' ? a.annotations?.[serverConfig.istioLabels.injectionLabelRev] ?? '' : a[key];
    const bValue = key === 'revision' ? b.annotations?.[serverConfig.istioLabels.injectionLabelRev] ?? '' : b[key];

    if (aValue < bValue) return sortDirection === SortByDirection.asc ? -1 : 1;
    if (aValue > bValue) return sortDirection === SortByDirection.asc ? 1 : -1;
    return 0;
  });

  const rows: IRow[] = sortedPods.map((pod, _podIdx) => {
    let validation: ObjectValidation = {} as ObjectValidation;

    if (props.validations[pod.name]) {
      validation = props.validations[pod.name];
    }

    const podProperties = (
      <DescriptionList isCompact>
        <DescriptionListGroup>
          <DescriptionListTerm>Created</DescriptionListTerm>
          <DescriptionListDescription>
            <LocalTime time={pod.createdAt} />
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Created By</DescriptionListTerm>
          <DescriptionListDescription>
            {pod.createdBy && pod.createdBy.length > 0
              ? pod.createdBy.map(ref => `${ref.name} (${ref.kind})`).join(', ')
              : 'Not found'}
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Service Account</DescriptionListTerm>
          <DescriptionListDescription>{pod.serviceAccountName ?? 'Not found'}</DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Istio Init Container</DescriptionListTerm>
          <DescriptionListDescription>
            {pod.istioInitContainers ? pod.istioInitContainers.map(c => `${c.image}`).join(', ') : 'Not found'}
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Istio Container</DescriptionListTerm>
          <DescriptionListDescription>
            {pod.istioContainers ? pod.istioContainers.map(c => `${c.image}`).join(', ') : 'Not found'}
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm data-test="protocol">Protocol</DescriptionListTerm>
          <DescriptionListDescription data-test="protocol-value">
            {pod.protocol ? pod.protocol : ''}
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Labels</DescriptionListTerm>
          <DescriptionListDescription>
            <Labels labels={pod.labels} expanded={true} />
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    );

    return {
      cells: [
        <span className={nameCellStyle}>
          <PFBadge badge={PFBadges.Pod} size="sm" position={TooltipPosition.top} />

          <Tooltip content={pod.name} position={TooltipPosition.top}>
            <span className={podNameStyle}>{pod.name}</span>
          </Tooltip>

          <Popover
            aria-label="Pod details"
            className={podPopoverStyle}
            position={PopoverPosition.right}
            headerContent={
              <>
                <PFBadge badge={PFBadges.Pod} size="sm" /> {pod.name}
              </>
            }
            bodyContent={podProperties}
            showClose={true}
            triggerAction="click"
          >
            <span data-test="pod-info" style={{ cursor: 'pointer' }}>
              <KialiIcon.Info className={infoStyle} />
            </span>
          </Popover>
        </span>,

        <Tooltip
          content={pod.annotations?.[serverConfig.istioLabels.injectionLabelRev] ?? 'N/A'}
          position={TooltipPosition.top}
        >
          <span className={podNameStyle}>{pod.annotations?.[serverConfig.istioLabels.injectionLabelRev] ?? 'N/A'}</span>
        </Tooltip>,

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
          className={fixedTableStyle}
          label="Workload Pod List"
          columns={columns}
          rows={rows}
          variant={TableVariant.compact}
          emptyState={noPods}
          sortBy={sort}
          onSort={onSort}
        />
      </CardBody>
    </Card>
  );
};
