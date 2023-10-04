import * as React from 'react';
import { Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';
import { Gateway, ObjectCheck, ObjectValidation, VirtualService } from '../../types/IstioObjects';
import { ValidationList } from '../../components/Validations/ValidationList';
import { KialiIcon } from '../../config/KialiIcon';

type Props = {
  serviceDetails: ServiceDetailsInfo;
  gateways: Gateway[];
  validations?: ObjectValidation;
};

type HostnameInfo = {
  hostname: string;
  fromType: string | undefined;
  fromName: string | undefined;
};

const resourceListStyle = kialiStyle({
  margin: '0px 0 11px 0',
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const infoStyle = kialiStyle({
  margin: '0px 0px 2px 10px',
  verticalAlign: '-3px !important'
});

export class ServiceNetwork extends React.Component<Props> {
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

  getHostnames(virtualServices: VirtualService[]): HostnameInfo[] {
    var hostnames: HostnameInfo[] = [];

    virtualServices.forEach(vs => {
      vs.spec.hosts?.forEach(host => {
        if (host === '*') {
          vs.spec.gateways?.forEach(vsGatewayName => {
            const vsGateways = this.props.gateways.filter(gateway => {
              return gateway.metadata.name === vsGatewayName;
            });

            vsGateways.forEach(vsGateway => {
              vsGateway.spec.servers?.forEach(servers => {
                servers.hosts.forEach(host => {
                  hostnames.push({ hostname: host, fromType: vsGateway.kind, fromName: vsGateway.metadata.name });
                });
              });
            });
          });
        } else {
          hostnames.push({ hostname: host, fromType: vs.kind, fromName: vs.metadata.name });
        }
      });
    });

    // If there is a wildcard, then it will display only one, the first match
    for (var hostnameInfo of hostnames) {
      if (hostnameInfo.hostname === '*') {
        return [hostnameInfo];
      }
    }

    return hostnames;
  }

  render() {
    return (
      <Card isCompact={true} id={'ServiceNetworkCard'}>
        <CardHeader>
          <Title headingLevel="h3" size={TitleSizes['2xl']}>
            Network
          </Title>
        </CardHeader>
        <CardBody>
          <div key="network-list" className={resourceListStyle}>
            <ul style={{ listStyleType: 'none' }}>
              <li>
                <span>Type</span>
                {this.props.serviceDetails.service.type}
              </li>
              {this.props.serviceDetails.service.type !== 'External' && (
                <li>
                  <span>
                    {this.props.serviceDetails.service.type !== 'ExternalName' ? 'Service IP' : 'ExternalName'}
                  </span>
                  {this.props.serviceDetails.service.type !== 'ExternalName'
                    ? this.props.serviceDetails.service.ip
                      ? this.props.serviceDetails.service.ip
                      : ''
                    : this.props.serviceDetails.service.externalName
                    ? this.props.serviceDetails.service.externalName
                    : ''}
                </li>
              )}
              {this.props.serviceDetails.endpoints && this.props.serviceDetails.endpoints.length > 0 && (
                <li>
                  <span>Endpoints</span>
                  <div style={{ display: 'inline-block' }}>
                    {(this.props.serviceDetails.endpoints || []).map((endpoint, i) => {
                      return (endpoint.addresses || []).map((address, u) => (
                        <div key={'endpoint_' + i + '_address_' + u}>
                          {address.name !== '' ? (
                            <Tooltip
                              position={TooltipPosition.right}
                              content={
                                <div style={{ textAlign: 'left' }}>
                                  {address.kind}: {address.name}
                                </div>
                              }
                            >
                              <span>
                                {address.ip} <KialiIcon.Info className={infoStyle} />
                              </span>
                            </Tooltip>
                          ) : (
                            <>{address.name}</>
                          )}
                        </div>
                      ));
                    })}
                  </div>
                </li>
              )}
              {this.props.serviceDetails.service.ports && this.props.serviceDetails.service.ports.length > 0 && (
                <li>
                  <span>Ports</span>
                  <div style={{ display: 'inline-block' }}>
                    {(this.props.serviceDetails.service.ports || []).map((port, i) => {
                      return (
                        <div key={'port_' + i}>
                          <div>
                            <span style={{ marginRight: '10px' }}>
                              {port.name} {port.port}
                            </span>
                            {this.hasIssue(i) ? this.getPortOver(i) : undefined}
                            {port.appProtocol && port.appProtocol !== '' ? (
                              <Tooltip
                                position={TooltipPosition.right}
                                content={<div style={{ textAlign: 'left' }}>App Protocol: {port.appProtocol}</div>}
                              >
                                <span style={{ marginRight: '5px' }}>
                                  <KialiIcon.Info className={infoStyle} />
                                </span>
                              </Tooltip>
                            ) : undefined}
                          </div>
                          <div>({port.protocol})</div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              )}
              {this.props.serviceDetails.virtualServices.length > 0 && (
                <li>
                  <span>Hostnames</span>
                  <div
                    style={{
                      display: 'inline-block',
                      width: '75%'
                    }}
                  >
                    {this.getHostnames(this.props.serviceDetails.virtualServices).map((hostname, i) => {
                      return (
                        <div key={'hostname_' + i}>
                          <Tooltip
                            position={TooltipPosition.right}
                            content={
                              <div style={{ textAlign: 'left' }}>
                                {hostname.fromType} {hostname.fromName}: {hostname.hostname}
                              </div>
                            }
                          >
                            <div style={{ display: 'flex' }}>
                              <span
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {hostname.hostname}
                              </span>
                              <span>
                                <KialiIcon.Info className={infoStyle} />
                              </span>
                            </div>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </CardBody>
      </Card>
    );
  }
}
