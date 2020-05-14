import * as React from 'react';
import { checkForPath, highestSeverity } from '../../../types/ServiceInfo';
import { Host, ObjectValidation, VirtualService } from '../../../types/IstioObjects';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import VirtualServiceRoute from './VirtualServiceRoute';
import { Link } from 'react-router-dom';
import { Card, CardBody, Grid, GridItem, Stack, StackItem, Text, TextVariants, Title } from '@patternfly/react-core';
import GlobalValidation from '../../../components/Validations/GlobalValidation';

interface VirtualServiceProps {
  namespace: string;
  virtualService: VirtualService;
  validation?: ObjectValidation;
}

class VirtualServiceDetail extends React.Component<VirtualServiceProps> {
  validation(): ObjectValidation | undefined {
    return this.props.validation;
  }

  globalStatus() {
    const validation = this.props.validation;
    if (validation && !validation.valid) {
      return <GlobalValidation validation={validation} />;
    } else {
      return undefined;
    }
  }

  hostStatusMessage() {
    const checks = checkForPath(this.validation(), 'spec/hosts');
    const severity = highestSeverity(checks);

    return {
      message: checks.map(check => check.message).join(','),
      severity
    };
  }

  parseHost(host: string): Host {
    if (host.includes('/')) {
      const gatewayParts = host.split('/');
      return {
        service: gatewayParts[1],
        namespace: gatewayParts[0]
      };
    }

    const hostParts = host.split('.');
    const h = {
      service: hostParts[0],
      namespace: this.props.namespace
    };

    if (hostParts.length > 1) {
      h.namespace = hostParts[1];
    }

    return h;
  }

  generateGatewaysList(gateways: string[], isValid: boolean) {
    const childrenList: any = [];
    Object.keys(gateways).forEach((key, j) => {
      const host = this.parseHost(gateways[key]);
      childrenList.push(
        <li key={'gateway_' + host.service + '_' + j}>
          {host.service === 'mesh' || !isValid ? (
            host.service
          ) : (
            <Link to={`/namespaces/${host.namespace}/istio/gateways/${host.service}`}>{gateways[key]}</Link>
          )}
        </li>
      );
    });

    return (
      <>
        <Text component={TextVariants.h3}>Gateways</Text>
        <ul className={'details'}>{childrenList}</ul>
      </>
    );
  }

  rawConfig() {
    const virtualService: VirtualService = this.props.virtualService;
    const globalStatus = this.globalStatus();
    const isValid = !globalStatus;

    return (
      <GridItem>
        <Card key={'virtualServiceConfig'}>
          <CardBody>
            <Title headingLevel="h3" size="2xl">
              Virtual Service Overview
            </Title>
            {globalStatus}
            <Stack gutter={'md'} style={{ marginTop: '10px' }}>
              <StackItem id={'name'}>
                <Title headingLevel="h6" size="md">
                  Name
                </Title>
                {virtualService.metadata.name || ''}
              </StackItem>
              <StackItem id={'created_at'}>
                <Title headingLevel="h6" size="md">
                  Created at
                </Title>
                <LocalTime time={virtualService.metadata.creationTimestamp || ''} />
              </StackItem>
              <StackItem id={'resource_version'}>
                <Title headingLevel="h6" size="md">
                  Resource Version
                </Title>
                {virtualService.metadata.resourceVersion}
              </StackItem>
              <StackItem id={'hosts'}>
                {virtualService.spec.hosts && virtualService.spec.hosts.length > 0 ? (
                  <>
                    <Title headingLevel="h6" size="md">
                      Hosts
                    </Title>
                    <DetailObject name="" detail={virtualService.spec.hosts} validation={this.hostStatusMessage()} />
                  </>
                ) : (
                  undefined
                )}
              </StackItem>
              <StackItem id={'gateways'}>
                {virtualService.spec.gateways && virtualService.spec.gateways.length > 0
                  ? this.generateGatewaysList(virtualService.spec.gateways, isValid)
                  : undefined}
              </StackItem>
            </Stack>
          </CardBody>
        </Card>
      </GridItem>
    );
  }

  weights() {
    const virtualService: VirtualService = this.props.virtualService;
    const protocols = [
      { name: 'HTTP', object: virtualService.spec.http },
      { name: 'TCP', object: virtualService.spec.tcp },
      { name: 'TLS', object: virtualService.spec.tls }
    ];

    return protocols.map((protocol, i) => {
      const { name, object } = protocol;
      if (object && object.length > 0) {
        return (
          <GridItem key={'virtualserviceroute-grid' + i}>
            <Card>
              <CardBody>
                <VirtualServiceRoute
                  name={virtualService.metadata.name}
                  namespace={virtualService.metadata.namespace || ''}
                  kind={name}
                  routes={object}
                  validation={this.props.validation}
                />
              </CardBody>
            </Card>
          </GridItem>
        );
      } else {
        return undefined;
      }
    });
  }

  render() {
    return (
      <Grid style={{ margin: '10px' }} gutter={'md'}>
        {this.rawConfig()}
        {this.weights()}
      </Grid>
    );
  }
}

export default VirtualServiceDetail;
