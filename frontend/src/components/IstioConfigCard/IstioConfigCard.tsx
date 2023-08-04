import * as React from 'react';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { cellWidth, ICell, Table, Tbody, Thead, Td, Tr, Th, TableVariant } from '@patternfly/react-table';
import {
  Bullseye,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  TooltipPosition
} from '@patternfly/react-core';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import { IstioTypes } from '../VirtualList/Config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFBadge } from '../Pf/PfBadges';
import { IstioObjectLink } from '../Link/IstioObjectLink';

type Props = {
  name: string;
  items: IstioConfigItem[];
};

const emtpytStyle = kialiStyle({
  padding: '0 0 0 0',
  margin: '0 0 0 0'
});

export class IstioConfigCard extends React.Component<Props> {
  columns(): ICell[] {
    return [{ title: 'Name' }, { title: 'Status', transforms: [cellWidth(10) as any] }];
  }

  overviewLink(item: IstioConfigItem) {
    return (
      <IstioObjectLink name={item.name} namespace={item.namespace || ''} cluster={item.cluster} type={item.type}>
        {item.name}
      </IstioObjectLink>
    );
  }

  rows(): React.ReactNode {
    if (this.props.items.length === 0) {
      return (
        <Tr>
          <Td colSpan={2}>
            <Bullseye>
              <EmptyState variant={EmptyStateVariant.sm} className={emtpytStyle}>
                <EmptyStateBody className={emtpytStyle} data-test="istio-config-empty">
                  No Istio Config found for {this.props.name}
                </EmptyStateBody>
              </EmptyState>
            </Bullseye>
          </Td>
        </Tr>
      );
    }
    let rows: React.ReactNode[] = [];
    this.props.items
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
        rows.push(
          <Tr key={itemIdx}>
            <Td>
              <span>
                <PFBadge badge={IstioTypes[item.type].badge} position={TooltipPosition.top} />
                {this.overviewLink(item)}
              </span>
            </Td>
            <Td>
              <ValidationObjectSummary
                id={itemIdx + '-config-validation'}
                validations={item.validation ? [item.validation] : []}
                style={{ verticalAlign: '-0.5em' }}
              />
            </Td>
          </Tr>
        );
        return rows;
      });

    return rows;
  }

  render() {
    return (
      <Card isCompact={true} id={'IstioConfigCard'}>
        <CardHeader>
          <CardTitle style={{ float: 'left' }}>Istio Config</CardTitle>
        </CardHeader>
        <CardBody>
          <Table variant={TableVariant.compact} aria-label={'list_istio_config'} className="table">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th width={10}>Status</Th>
              </Tr>
            </Thead>
            <Tbody>{this.rows()}</Tbody>
          </Table>
        </CardBody>
      </Card>
    );
  }
}
