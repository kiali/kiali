import * as React from 'react';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { IRow, IRowCell, Table, TableVariant, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table';
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
import { IstioTypes } from '../VirtualList/Config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFBadge } from '../Pf/PfBadges';
import { IstioObjectLink } from '../Link/IstioObjectLink';

type IstioConfigCardProps = {
  items: IstioConfigItem[];
  name: string;
};

const emtpytStyle = kialiStyle({
  padding: '0',
  margin: '0'
});

export const IstioConfigCard: React.FC<IstioConfigCardProps> = (props: IstioConfigCardProps) => {
  const columns: ThProps[] = [{ title: 'Name' }, { title: 'Status', width: 10 }];

  const noIstioConfig: IRow = {
    cells: [
      {
        title: (
          <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
            <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
              No Istio Config found for {props.name}
            </EmptyStateBody>
          </EmptyState>
        ),
        props: { colSpan: 2 }
      }
    ]
  };

  const overviewLink = (item: IstioConfigItem) => {
    return (
      <IstioObjectLink name={item.name} namespace={item.namespace || ''} cluster={item.cluster} type={item.type}>
        {item.name}
      </IstioObjectLink>
    );
  };

  let rows: IRow[] = [];

  if (props.items.length === 0) {
    rows = [noIstioConfig];
  } else {
    rows = props.items
      .sort((a: IstioConfigItem, b: IstioConfigItem) => {
        if (a.type < b.type) {
          return -1;
        } else if (a.type > b.type) {
          return 1;
        } else {
          return a.name < b.name ? -1 : 1;
        }
      })
      .map((item, itemIdx) => {
        return {
          cells: [
            {
              title: (
                <span>
                  <PFBadge badge={IstioTypes[item.type].badge} position={TooltipPosition.top} />
                  {overviewLink(item)}
                </span>
              )
            },
            {
              title: (
                <ValidationObjectSummary
                  id={itemIdx + '-config-validation'}
                  validations={item.validation ? [item.validation] : []}
                />
              )
            }
          ]
        };
      });
  }

  return (
    <Card isCompact={true} id={'IstioConfigCard'}>
      <CardHeader actions={{ actions: <></>, hasNoOffset: false }}>
        <Title headingLevel="h3" size={TitleSizes.lg}>
          Istio Config
        </Title>
      </CardHeader>
      <CardBody>
        <Table variant={TableVariant.compact} aria-label={'list_istio_config'}>
          <Thead>
            <Tr>
              {columns.map((column, index) => (
                <Th key={`column_${index}`} dataLabel={column.title} width={column.width}>
                  {column.title}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, index) => (
              <Tr key={`row_${index}`}>
                {(row.cells as IRowCell[])?.map((cell, index) => (
                  <Td key={`cell_${index}`} dataLabel={columns[index].title} colSpan={cell.props?.colSpan}>
                    {cell.title}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
};
