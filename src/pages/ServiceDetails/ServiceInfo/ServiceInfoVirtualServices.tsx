import * as React from 'react';
import {
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  EmptyStateIcon,
  Grid,
  GridItem,
  Title
} from '@patternfly/react-core';
import { ICell, IRow, Table, TableHeader, TableBody, TableVariant, cellWidth } from '@patternfly/react-table';
import { CodeBranchIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import { ObjectValidation, VirtualService } from '../../../types/IstioObjects';
import './ServiceInfoVirtualServices.css';
import LocalTime from '../../../components/Time/LocalTime';
import { ValidationSummary } from '../../../components/Validations/ValidationSummary';
import { ServiceDetailsInfo } from '../../../types/ServiceInfo';

interface ServiceInfoVirtualServicesProps {
  virtualServices?: VirtualService[];
  service: ServiceDetailsInfo;
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoVirtualServices extends React.Component<ServiceInfoVirtualServicesProps> {
  columns(): ICell[] {
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    return [
      { title: 'Status', transforms: [cellWidth(10) as any] },
      { title: 'Name', transforms: [cellWidth(10) as any] },
      { title: 'Created at', transforms: [cellWidth(60) as any] },
      { title: 'Resource version', transforms: [cellWidth(10) as any] },
      { title: 'Actions', transforms: [cellWidth(10) as any] }
    ];
  }

  hasValidations(virtualService: VirtualService): boolean {
    // This is insane, but doing return to the clause inside the if will cause compiler failure
    return !!this.props.validations && !!this.props.validations[virtualService.metadata.name];
  }

  validation(virtualService: VirtualService): ObjectValidation {
    return this.props.validations[virtualService.metadata.name];
  }

  overviewLink(virtualService: VirtualService) {
    return (
      <Link
        to={
          '/namespaces/' +
          virtualService.metadata.namespace +
          '/istio/virtualservices/' +
          virtualService.metadata.name +
          '?list=overview'
        }
      >
        {virtualService.metadata.name}
      </Link>
    );
  }

  yamlLink(virtualService: VirtualService) {
    return (
      <Link
        to={
          '/namespaces/' +
          virtualService.metadata.namespace +
          '/istio/virtualservices/' +
          virtualService.metadata.name +
          '?list=yaml'
        }
      >
        View YAML
      </Link>
    );
  }

  noVirtualServices(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={CodeBranchIcon} />
                <Title headingLevel="h5" size="lg">
                  No VirtualServices {!this.props.service.istioSidecar && ' and Istio Sidecar '} found
                </Title>
                <EmptyStateBody>
                  No VirtualServices {!this.props.service.istioSidecar && ' and Istio Sidecar '} found for service{' '}
                  {this.props.service.service.name}
                </EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 5 }
          }
        ]
      }
    ];
  }

  rows(): IRow[] {
    if ((this.props.virtualServices || []).length === 0) {
      return this.noVirtualServices();
    }
    let rows: IRow[] = [];
    (this.props.virtualServices || []).map((virtualService, vsIdx) => {
      rows.push({
        cells: [
          {
            title: (
              <ValidationSummary
                id={vsIdx + '-config-validation'}
                validations={this.hasValidations(virtualService) ? [this.validation(virtualService)] : []}
              />
            )
          },
          { title: this.overviewLink(virtualService) },
          { title: <LocalTime time={virtualService.metadata.creationTimestamp || ''} /> },
          { title: virtualService.metadata.resourceVersion },
          { title: this.yamlLink(virtualService) }
        ]
      });
      return rows;
    });

    return rows;
  }

  render() {
    return (
      <Grid>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <Table
                variant={TableVariant.compact}
                aria-label={'list_virtual_services'}
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

export default ServiceInfoVirtualServices;
