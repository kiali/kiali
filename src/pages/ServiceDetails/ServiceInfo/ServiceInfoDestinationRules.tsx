import * as React from 'react';
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
import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import { NetworkIcon } from '@patternfly/react-icons';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import { ValidationObjectSummary } from '../../../components/Validations/ValidationObjectSummary';
import { DestinationRule, ObjectValidation, Subset } from '../../../types/IstioObjects';
import Labels from '../../../components/Label/Labels';
import { safeRender } from '../../../utils/SafeRender';
import { ServiceDetailsInfo } from '../../../types/ServiceInfo';
import IstioObjectLink from '../../../components/Link/IstioObjectLink';

interface ServiceInfoDestinationRulesProps {
  destinationRules?: DestinationRule[];
  service: ServiceDetailsInfo;
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoDestinationRules extends React.Component<ServiceInfoDestinationRulesProps> {
  columns(): ICell[] {
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    return [
      { title: 'Status' },
      { title: 'Name', transforms: [cellWidth(10) as any] },
      { title: 'Traffic Policy', transforms: [cellWidth(10) as any] },
      { title: 'Subsets', transforms: [cellWidth(30) as any] },
      { title: 'Host', transforms: [cellWidth(10) as any] },
      { title: 'Created at', transforms: [cellWidth(20) as any] },
      { title: 'Resource version', transforms: [cellWidth(10) as any] },
      { title: 'Actions', transforms: [cellWidth(20) as any] }
    ];
  }

  yamlLink(destinationRule: DestinationRule) {
    return (
      <IstioObjectLink
        name={destinationRule.metadata.name}
        namespace={destinationRule.metadata.namespace || ''}
        type={'destinationrule'}
        query={'list=yaml'}
      >
        View YAML
      </IstioObjectLink>
    );
  }

  hasValidations(destinationRule: DestinationRule): boolean {
    return !!this.props.validations && !!this.props.validations[destinationRule.metadata.name];
  }

  validation(destinationRule: DestinationRule): ObjectValidation {
    return this.props.validations[destinationRule.metadata.name];
  }

  overviewLink(destinationRule: DestinationRule) {
    return (
      <IstioObjectLink
        name={destinationRule.metadata.name}
        namespace={destinationRule.metadata.namespace || ''}
        type={'destinationrule'}
      >
        {destinationRule.metadata.name}
      </IstioObjectLink>
    );
  }

  noDestinationRules(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={NetworkIcon} />
                <Title headingLevel="h5" size="lg">
                  No Destination Rules {!this.props.service.istioSidecar && ' and Istio Sidecar '} found
                </Title>
                <EmptyStateBody>
                  No Destination Rules {!this.props.service.istioSidecar && ' and istioSidecar '} found for service{' '}
                  {this.props.service.service.name}
                </EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 8 }
          }
        ]
      }
    ];
  }

  rows(): IRow[] {
    if ((this.props.destinationRules || []).length === 0) {
      return this.noDestinationRules();
    }
    let rows: IRow[] = [];
    (this.props.destinationRules || []).map((destinationRule, vsIdx) => {
      rows.push({
        cells: [
          {
            title: (
              <ValidationObjectSummary
                id={vsIdx + '-config-validation'}
                validations={this.hasValidations(destinationRule) ? [this.validation(destinationRule)] : []}
                style={{ verticalAlign: '-0.5em' }}
              />
            )
          },
          { title: this.overviewLink(destinationRule) },
          {
            title: destinationRule.spec.trafficPolicy ? (
              <DetailObject name="" detail={destinationRule.spec.trafficPolicy} />
            ) : (
              'None'
            )
          },
          {
            title:
              destinationRule.spec.subsets && destinationRule.spec.subsets.length > 0
                ? this.generateSubsets(destinationRule.spec.subsets)
                : 'None'
          },
          {
            title: destinationRule.spec.host ? <DetailObject name="" detail={destinationRule.spec.host} /> : undefined
          },
          { title: <LocalTime time={destinationRule.metadata.creationTimestamp || ''} /> },
          { title: destinationRule.metadata.resourceVersion },
          { title: this.yamlLink(destinationRule) }
        ]
      });
      return rows;
    });

    return rows;
  }

  generateKey() {
    return 'key_' + Math.random().toString(36).substr(2, 9);
  }

  generateSubsets(subsets: Subset[]) {
    return (
      <>
        {subsets.map(subset => (
          <>
            <Grid gutter={'md'}>
              <GridItem span={3}>
                <span>{safeRender(subset.name)}</span>{' '}
              </GridItem>
              <GridItem span={4}>
                <Labels labels={subset.labels} />
              </GridItem>
              <GridItem span={4}>
                <DetailObject name={subset.trafficPolicy ? 'trafficPolicy' : ''} detail={subset.trafficPolicy} />
              </GridItem>
            </Grid>
          </>
        ))}
      </>
    );
  }

  render() {
    return (
      <Grid>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <Table
                variant={TableVariant.compact}
                aria-label={'list_workloads'}
                cells={this.columns()}
                rows={this.rows()}
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

export default ServiceInfoDestinationRules;
