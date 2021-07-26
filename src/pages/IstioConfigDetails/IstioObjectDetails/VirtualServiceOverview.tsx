import * as React from 'react';
import { checkForPath, highestSeverity } from '../../../types/ServiceInfo';
import { Host, HTTPRoute, ObjectValidation, TCPRoute, TLSRoute, VirtualService } from '../../../types/IstioObjects';
import VirtualServiceRoute from './VirtualServiceRoute';
import {
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title,
  TitleLevel,
  TitleSize,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import GlobalValidation from '../../../components/Validations/GlobalValidation';
import IstioObjectLink from '../../../components/Link/IstioObjectLink';
import ServiceLink from './ServiceLink';
import { KialiIcon } from 'config/KialiIcon';
import { style } from 'typestyle';

interface VirtualServiceProps {
  namespace: string;
  virtualService: VirtualService;
  validation?: ObjectValidation;
}

const infoStyle = style({
  margin: '0px 0px 2px 10px',
  verticalAlign: '-5px !important'
});

class VirtualServiceOverview extends React.Component<VirtualServiceProps> {
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
      message: checks.map(check => (check.code ? check.code + ' ' : '') + check.message).join(','),
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
          {!isValid ? (
            host.service
          ) : host.service === 'mesh' ? (
            <div>
              {host.service}
              <Tooltip
                position={TooltipPosition.right}
                content={
                  <div style={{ textAlign: 'left' }}>
                    The reserved word, "mesh", implies all of the sidecars in the mesh
                  </div>
                }
              >
                <KialiIcon.Info className={infoStyle} />
              </Tooltip>
            </div>
          ) : (
            <IstioObjectLink name={host.service} namespace={host.namespace} type={'gateway'}>
              {gateways[key]}
            </IstioObjectLink>
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

  generateServiceList(routes: HTTPRoute[] | TLSRoute[] | TCPRoute[], isValid: boolean) {
    const hosts: string[] = [];
    routes.forEach(route => {
      route.route?.forEach(dest => {
        if (!hosts.includes(dest.destination.host)) {
          hosts.push(dest.destination.host);
        }
      });
    });
    return hosts.length > 0 ? (
      <>
        <Text component={TextVariants.h3}>Hosts</Text>
        <ul className={'details'}>
          {hosts.map((host, i) => (
            <li key={'host_' + i}>
              <ServiceLink namespace={this.props.namespace} host={host} isValid={isValid} />
            </li>
          ))}
        </ul>
      </>
    ) : undefined;
  }

  render() {
    const virtualService: VirtualService = this.props.virtualService;
    const globalStatus = this.globalStatus();
    const isValid = !globalStatus;
    const protocols = [
      { name: 'HTTP', object: virtualService.spec.http },
      { name: 'TCP', object: virtualService.spec.tcp },
      { name: 'TLS', object: virtualService.spec.tls }
    ];
    return (
      <>
        <Title headingLevel={TitleLevel.h3} size={TitleSize.xl}>
          Virtual Service Overview
        </Title>
        <Stack>
          {virtualService.spec.gateways && virtualService.spec.gateways.length > 0 && (
            <StackItem id={'gateways'}>{this.generateGatewaysList(virtualService.spec.gateways, isValid)}</StackItem>
          )}
          {protocols.map((protocol, i) => {
            const { name, object } = protocol;
            if (object && object.length > 0) {
              return (
                <StackItem id={protocol.name + '-routes-' + i} key={protocol.name + '-routes-' + i}>
                  {protocol.name + ' Routes'}
                  <VirtualServiceRoute
                    name={virtualService.metadata.name}
                    namespace={virtualService.metadata.namespace || ''}
                    kind={name}
                    routes={object}
                  />
                  <div style={{ marginTop: 30 }}>{this.generateServiceList(object, isValid)}</div>
                </StackItem>
              );
            }
            return undefined;
          })}
        </Stack>
      </>
    );
  }
}

export default VirtualServiceOverview;
