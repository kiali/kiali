import * as React from 'react';
import {
  Card,
  CardBody,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title,
  Tooltip
} from '@patternfly/react-core';
import { EyeIcon } from '@patternfly/react-icons';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { ServiceHealth } from '../../../types/Health';
import { Endpoints } from '../../../types/ServiceInfo';
import { ObjectCheck, ObjectValidation, Port } from '../../../types/IstioObjects';
import { style } from 'typestyle';
import { ValidationSummary } from '../../../components/Validations/ValidationSummary';
import ValidationList from '../../../components/Validations/ValidationList';
import './ServiceInfoDescription.css';
import Labels from '../../../components/Label/Labels';
import { ThreeScaleServiceRule } from '../../../types/ThreeScale';

interface ServiceInfoDescriptionProps {
  name: string;
  namespace: string;
  createdAt: string;
  resourceVersion: string;
  istioEnabled?: boolean;
  labels?: { [key: string]: string };
  selectors?: { [key: string]: string };
  type?: string;
  ip?: any;
  externalName?: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  health?: ServiceHealth;
  threeScaleServiceRule?: ThreeScaleServiceRule;
  validations?: ObjectValidation;
}

const listStyle = style({
  listStyleType: 'none',
  padding: 0
});

const ExternalNameType = 'ExternalName';

class ServiceInfoDescription extends React.Component<ServiceInfoDescriptionProps> {
  getValidations(): ObjectValidation {
    return this.props.validations ? this.props.validations : ({} as ObjectValidation);
  }

  getPortOver(portId: number): any {
    return (
      <div style={{ float: 'left', fontSize: '12px', padding: '3px 0.6em 0 0' }}>
        <ValidationList checks={this.getPortChecks(portId)} />
      </div>
    );
  }

  getPortChecks(portId: number): ObjectCheck[] {
    return this.getValidations().checks.filter(c => c.path === 'spec/ports[' + portId + ']');
  }

  hasIssue(portId: number): boolean {
    return this.getPortChecks(portId).length > 0;
  }

  render() {
    console.log(this.props.health);
    return (
      <Grid gutter="md">
        <GridItem span={6}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Service overview{' '}
              </Title>
              <Stack>
                <StackItem id={'labels'}>
                  <Text component={TextVariants.h3}> Labels </Text>
                  <Labels labels={this.props.labels || {}} />
                </StackItem>
                <StackItem id={'resource_version'}>
                  <Text component={TextVariants.h3}> Resource Version </Text>
                  {this.props.resourceVersion}
                </StackItem>
                <StackItem id={'selectors'}>
                  <Text component={TextVariants.h3}> Selectors </Text>
                  <Labels labels={this.props.selectors || {}} />
                </StackItem>
                <StackItem id={'created_at'}>
                  <Text component={TextVariants.h3}> Created at </Text>
                  <LocalTime time={this.props.createdAt} />
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={6}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Health Overview{' '}
              </Title>
              <Stack className={'stack_service_details'}>
                <StackItem id={'health'}>
                  <Text component={TextVariants.h3}> Health </Text>
                  <HealthIndicator
                    id={this.props.name}
                    health={this.props.health}
                    mode={DisplayMode.LARGE}
                    tooltipPlacement="left"
                  />
                </StackItem>
              </Stack>
              <Title headingLevel="h3" size="2xl" style={{ marginTop: '60px' }}>
                {' '}
                Network Overview{' '}
              </Title>
              <Stack>
                <StackItem id={'ip'}>
                  <Text component={TextVariants.h3}>
                    {' '}
                    {this.props.type !== ExternalNameType ? 'Service IP' : 'ExternalName'}{' '}
                  </Text>
                  {this.props.type !== ExternalNameType
                    ? this.props.ip
                      ? this.props.ip
                      : ''
                    : this.props.externalName
                    ? this.props.externalName
                    : ''}
                </StackItem>
                <StackItem id={'endpoints'}>
                  <Text component={TextVariants.h3}> Endpoints </Text>
                  <Stack>
                    {(this.props.endpoints || []).map((endpoint, i) =>
                      (endpoint.addresses || []).map((address, u) => (
                        <StackItem key={'endpoint_' + i + '_address_' + u}>
                          {address.name !== '' ? (
                            <Tooltip content={<>{address.name}</>}>
                              <span>
                                <EyeIcon /> {address.ip}
                              </span>
                            </Tooltip>
                          ) : (
                            <>{address.name}</>
                          )}
                        </StackItem>
                      ))
                    )}
                  </Stack>
                </StackItem>
                <StackItem id={'ports'}>
                  <Text component={TextVariants.h3}>
                    <ValidationSummary
                      id={this.props.name + '-config-validation'}
                      validations={[this.getValidations()]}
                    />
                    <span style={{ marginLeft: '10px' }}>Ports</span>
                  </Text>
                  <ul className={listStyle}>
                    {(this.props.ports || []).map((port, i) => (
                      <li key={'port_' + i}>
                        {this.hasIssue(i) ? this.getPortOver(i) : undefined}
                        {port.protocol} {port.name} ({port.port})
                      </li>
                    ))}
                  </ul>
                </StackItem>
                <StackItem id={'type'}>
                  <Text component={TextVariants.h3}> Type </Text>
                  {this.props.type ? this.props.type : ''}
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    );
  }
}

export default ServiceInfoDescription;
