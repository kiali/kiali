import * as React from 'react';
import { WorkloadGroupEntry } from '../../types/IstioObjects';
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
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { LocalTime } from '../../components/Time/LocalTime';
import { Labels } from '../../components/Label/Labels';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { SimpleTable } from 'components/Table/SimpleTable';
import { infoStyle } from 'styles/IconStyle';

type WorkloadEntriesProps = {
  entries: WorkloadGroupEntry[];
  namespace: string;
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

const iconStyle = kialiStyle({
  display: 'inline-block'
});

export const WorkloadEntries: React.FC<WorkloadEntriesProps> = (props: WorkloadEntriesProps) => {
  const columns: ThProps[] = [{ title: 'Name' }];

  const noEntries: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle}>
      <EmptyStateBody className={emptyStyle}>No Workload Entries in Workload {props.workload}</EmptyStateBody>
    </EmptyState>
  );

  const rows: IRow[] = props.entries
    .sort((p1: WorkloadGroupEntry, p2: WorkloadGroupEntry) => (p1.name < p2.name ? -1 : 1))
    .map((entry, _entryIdx) => {
      const entryProperties = (
        <div key="properties-list" className={resourceListStyle}>
          <ul style={{ listStyleType: 'none' }}>
            <li>
              <span>Created</span>
              <div style={{ display: 'inline-block' }}>
                <LocalTime time={entry.createdAt} />
              </div>
            </li>

            <li>
              <span>Service Account</span>
              <div style={{ display: 'inline-block' }}>{entry.serviceAccountName ?? 'Not found'}</div>
            </li>

            <li>
              <span>Labels</span>
              <div style={{ display: 'inline-block' }}>
                <Labels labels={entry.labels} expanded={true} />
              </div>
            </li>
          </ul>
        </div>
      );

      return {
        cells: [
          <span>
            <div key="service-icon" className={iconStyle}>
              <PFBadge badge={PFBadges.WorkloadEntry} size="sm" position={TooltipPosition.top} />
            </div>

            {entry.name}

            <Tooltip
              position={TooltipPosition.right}
              content={<div style={{ textAlign: 'left' }}>{entryProperties}</div>}
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </span>
        ]
      };
    });

  return (
    <Card isCompact={true} id="WorkloadEntriesCard">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          Workload Entries
        </Title>
      </CardHeader>

      <CardBody>
        <SimpleTable
          label="Workload Entries List"
          columns={columns}
          rows={rows}
          variant={TableVariant.compact}
          emptyState={noEntries}
        />
      </CardBody>
    </Card>
  );
};
