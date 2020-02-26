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
import { style } from 'typestyle';
import CytoscapeGraph from '../../../components/CytoscapeGraph/CytoscapeGraph';
import { DagreGraph } from '../../../components/CytoscapeGraph/graphs/DagreGraph';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import GraphDataSource from '../../../services/GraphDataSource';
import { ServiceHealth } from '../../../types/Health';
import { Endpoints } from '../../../types/ServiceInfo';
import { ObjectCheck, ObjectValidation, Port } from '../../../types/IstioObjects';
import { EdgeLabelMode, GraphType } from '../../../types/Graph';
import { ValidationObjectSummary } from '../../../components/Validations/ValidationObjectSummary';
import ValidationList from '../../../components/Validations/ValidationList';
import './ServiceInfoDescription.css';
import Labels from '../../../components/Label/Labels';
import { ThreeScaleServiceRule } from '../../../types/ThreeScale';
import { AdditionalItem } from 'types/Workload';
import { TextOrLink } from 'components/TextOrLink';
import { renderAPILogo } from 'components/Logo/Logos';

interface ServiceInfoDescriptionProps {
  name: string;
  namespace: string;
  createdAt: string;
  resourceVersion: string;
  additionalDetails: AdditionalItem[];
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
  miniGraphDatasource: GraphDataSource;
}

const listStyle = style({
  listStyleType: 'none',
  padding: 0
});

const ExternalNameType = 'ExternalName';

const cytoscapeGraphContainerStyle = style({ height: '300px' });

class ServiceInfoDescription extends React.Component<ServiceInfoDescriptionProps> {
  getPortOver(portId: number) {
    return <ValidationList checks={this.getPortChecks(portId)} />;
  }

  getPortChecks(portId: number): ObjectCheck[] {
    return this.props.validations
      ? this.props.validations.checks.filter(c => c.path === 'spec/ports[' + portId + ']')
      : [];
  }

  hasIssue(portId: number): boolean {
    return this.getPortChecks(portId).length > 0;
  }

  render() {
    return (
      <Grid gutter="md">
        <GridItem span={4}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Service Overview{' '}
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
                {this.props.additionalDetails.map((additionalItem, idx) => {
                  return (
                    <StackItem key={'additional-details-' + idx} id={'additional-details-' + idx}>
                      <Text component={TextVariants.h3}> {additionalItem.title} </Text>
                      {additionalItem.icon && renderAPILogo(additionalItem.icon, undefined, idx)}
                      <TextOrLink text={additionalItem.value} urlTruncate={64} />
                    </StackItem>
                  );
                })}
                {this.props.threeScaleServiceRule && this.props.threeScaleServiceRule.threeScaleHandlerName !== '' && (
                  <StackItem id={'threescale_link'}>
                    <Text component={TextVariants.h3}> 3scale API handler</Text>
                    <TextOrLink text={this.props.threeScaleServiceRule.threeScaleHandlerName} />
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={4}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Graph Overview{' '}
              </Title>
              <div style={{ height: '100%' }}>
                <CytoscapeGraph
                  activeNamespaces={[{ name: this.props.namespace }]}
                  containerClassName={cytoscapeGraphContainerStyle}
                  dataSource={this.props.miniGraphDatasource}
                  displayUnusedNodes={() => undefined}
                  edgeLabelMode={EdgeLabelMode.NONE}
                  graphType={GraphType.APP}
                  isMTLSEnabled={false}
                  isMiniGraph={true}
                  layout={DagreGraph.getLayout()}
                  refreshInterval={0}
                  showCircuitBreakers={false}
                  showMissingSidecars={true}
                  showNodeLabels={true}
                  showSecurity={false}
                  showServiceNodes={true}
                  showTrafficAnimation={true}
                  showUnusedNodes={false}
                  showVirtualServices={true}
                />
              </div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={4}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Health Overview{' '}
              </Title>
              <Stack className={'stack_service_details'}>
                <StackItem id={'health'}>
                  <Text component={TextVariants.h3}> Overall Health </Text>
                  <HealthIndicator id={this.props.name} health={this.props.health} mode={DisplayMode.LARGE} />
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
                    <ValidationObjectSummary
                      id={this.props.name + '-config-validation'}
                      validations={this.props.validations ? [this.props.validations] : []}
                    />
                    <span style={{ marginLeft: '10px' }}>Ports</span>
                  </Text>
                  <ul className={listStyle}>
                    {(this.props.ports || []).map((port, i) => (
                      <li key={'port_' + i}>
                        {this.hasIssue(i) ? this.getPortOver(i) : undefined} {port.protocol} {port.name} ({port.port})
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
