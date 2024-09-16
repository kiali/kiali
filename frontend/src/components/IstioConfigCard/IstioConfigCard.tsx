import * as React from 'react';
import { IstioConfigItem } from '../../types/IstioConfigList';
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
  TooltipPosition
} from '@patternfly/react-core';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import { GVKToBadge } from '../VirtualList/Config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFBadge } from '../Pf/PfBadges';
import { IstioObjectLink } from '../Link/IstioObjectLink';
import { SimpleTable } from 'components/Table/SimpleTable';
import { getIstioObjectGVK, gvkToString } from '../../utils/IstioConfigUtils';

type IstioConfigCardProps = {
  items: IstioConfigItem[];
  name: string;
};

const emtpytStyle = kialiStyle({
  padding: 0,
  margin: 0
});

export const IstioConfigCard: React.FC<IstioConfigCardProps> = (props: IstioConfigCardProps) => {
  const columns: ThProps[] = [{ title: 'Name' }, { title: 'Status', width: 10 }];

  const noIstioConfig: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
      <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
        No Istio Config found for {props.name}
      </EmptyStateBody>
    </EmptyState>
  );

  const overviewLink = (item: IstioConfigItem): React.ReactNode => {
    return (
      <IstioObjectLink
        name={item.name}
        namespace={item.namespace ?? ''}
        cluster={item.cluster}
        objectGVK={getIstioObjectGVK(item.apiVersion, item.kind)}
      >
        {item.name}
      </IstioObjectLink>
    );
  };

  const rows: IRow[] = props.items
    .sort((a: IstioConfigItem, b: IstioConfigItem) => {
      // TODO localCompare with apiVersion
      if ((a.kind ?? '') < (b.kind ?? '')) {
        return -1;
      } else if ((a.kind ?? '') > (b.kind ?? '')) {
        return 1;
      } else {
        return a.name < b.name ? -1 : 1;
      }
    })
    .map((item, itemIdx) => {
      return {
        cells: [
          <span>
            <PFBadge
              badge={GVKToBadge[gvkToString(getIstioObjectGVK(item.apiVersion, item.kind))]}
              position={TooltipPosition.top}
            />
            {overviewLink(item)}
          </span>,
          <ValidationObjectSummary
            id={`${itemIdx}-config-validation`}
            validations={item.validation ? [item.validation] : []}
          />
        ]
      };
    });

  return (
    <Card isCompact={true} id="IstioConfigCard">
      <CardHeader actions={{ actions: <></>, hasNoOffset: false }}>
        <Title headingLevel="h3" size={TitleSizes.lg}>
          Istio Config
        </Title>
      </CardHeader>

      <CardBody>
        <SimpleTable
          label="Istio Config List"
          columns={columns}
          rows={rows}
          variant={TableVariant.compact}
          emptyState={noIstioConfig}
        />
      </CardBody>
    </Card>
  );
};
