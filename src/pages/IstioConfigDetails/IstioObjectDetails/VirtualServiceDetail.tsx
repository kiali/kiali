import * as React from 'react';
import { checkForPath, highestSeverity } from '../../../types/ServiceInfo';
import { Host, ObjectValidation, VirtualService } from '../../../types/IstioObjects';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import VirtualServiceRoute from './VirtualServiceRoute';
import { Link } from 'react-router-dom';
import { Card, CardBody, Grid, GridItem, Text, TextVariants } from '@patternfly/react-core';
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

  generateGatewaysList(gateways: string[]) {
    const childrenList: any = [];
    Object.keys(gateways).forEach((key, j) => {
      const host = this.parseHost(gateways[key]);
      childrenList.push(
        <li key={'gateway_' + host.service + '_' + j}>
          {host.service === 'mesh' ? (
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

    return (
      <GridItem>
        <Card key={'virtualServiceConfig'}>
          <CardBody>
            <Text component={TextVariants.h2}>Virtual Service Overview</Text>
            {this.globalStatus()}
            <Text component={TextVariants.h3}>Created at</Text>
            <LocalTime time={virtualService.metadata.creationTimestamp || ''} />

            <Text component={TextVariants.h3}>Resource Version</Text>
            {virtualService.metadata.resourceVersion}

            {virtualService.spec.hosts && virtualService.spec.hosts.length > 0 ? (
              <>
                <Text component={TextVariants.h3}>Hosts</Text>
                <DetailObject name="" detail={virtualService.spec.hosts} validation={this.hostStatusMessage()} />
              </>
            ) : (
              undefined
            )}
            {virtualService.spec.gateways && virtualService.spec.gateways.length > 0
              ? this.generateGatewaysList(virtualService.spec.gateways)
              : undefined}
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
      <div className="container-fluid container-cards-pf">
        <Grid gutter={'md'}>
          {this.rawConfig()}
          {this.weights()}
        </Grid>
      </div>
    );
  }
}

export default VirtualServiceDetail;
