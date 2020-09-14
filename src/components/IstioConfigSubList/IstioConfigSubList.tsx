import * as React from 'react';
import { dicIstioType, IstioConfigItem } from '../../types/IstioConfigList';
import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import {
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateVariant,
  Grid,
  GridItem,
  Title
} from '@patternfly/react-core';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import LocalTime from '../Time/LocalTime';
import { CodeBranchIcon } from '@patternfly/react-icons';
import IstioObjectLink from '../Link/IstioObjectLink';

interface Props {
  name: string;
  items: IstioConfigItem[];
}

class IstioConfigSubList extends React.Component<Props> {
  columns(): ICell[] {
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    return [
      { title: 'Status', transforms: [cellWidth(10) as any] },
      { title: 'Name' },
      { title: 'Type' },
      { title: 'Created at' },
      { title: 'Resource version' },
      { title: 'Actions' }
    ];
  }

  noIstioConfig(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={CodeBranchIcon} />
                <Title headingLevel="h5" size="lg">
                  No Istio Config found
                </Title>
                <EmptyStateBody>No Istio Config found for {this.props.name}</EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 6 }
          }
        ]
      }
    ];
  }

  overviewLink(item: IstioConfigItem) {
    return (
      <IstioObjectLink name={item.name} namespace={item.namespace || ''} type={item.type}>
        {item.name}
      </IstioObjectLink>
    );
  }

  yamlLink(item: IstioConfigItem) {
    return (
      <IstioObjectLink name={item.name} namespace={item.namespace || ''} type={item.type} query={'list=yaml'}>
        View YAML
      </IstioObjectLink>
    );
  }

  rows(): IRow[] {
    if (this.props.items.length === 0) {
      return this.noIstioConfig();
    }
    let rows: IRow[] = [];
    this.props.items.map((item, itemIdx) => {
      rows.push({
        cells: [
          {
            title: (
              <ValidationObjectSummary
                id={itemIdx + '-config-validation'}
                validations={item.validation ? [item.validation] : []}
                style={{ verticalAlign: '-0.5em' }}
              />
            )
          },
          { title: this.overviewLink(item) },
          { title: dicIstioType[item.type] },
          { title: <LocalTime time={item.creationTimestamp || ''} /> },
          { title: item.resourceVersion },
          { title: this.yamlLink(item) }
        ]
      });
      return rows;
    });

    return rows;
  }
  table;
  render() {
    return (
      <Grid>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <Table
                variant={TableVariant.compact}
                aria-label={'list_istio_config'}
                cells={this.columns()}
                rows={this.rows()}
                // This style is declared on _overrides.scss
                className="table"
              >
                <TableHeader />
                <TableBody />
              </Table>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    );
  }
}

export default IstioConfigSubList;
