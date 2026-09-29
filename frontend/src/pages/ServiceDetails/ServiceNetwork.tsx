import * as React from 'react';
import { Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import type { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';
import type { Gateway, ObjectCheck, ObjectValidation, VirtualService } from '../../types/IstioObjects';
import { ValidationList } from '../../components/Validations/ValidationList';
import { KialiIcon } from '../../config/KialiIcon';
import { infoStyle } from 'styles/IconStyle';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { IPFamily } from '../../types/ServiceInfo';

type ServiceNetworkProps = {
  gateways: Gateway[];
  serviceDetails: ServiceDetailsInfo;
  validations?: ObjectValidation;
};

type HostnameInfo = {
  fromName: string | undefined;
  fromType: string | undefined;
  hostname: string;
};

const getServiceIpLabel = (ipFamily: IPFamily | undefined, translate: (key: string) => string): string => {
  if (ipFamily === 'IPv4') {
    return translate('Service IPv4');
  }

  if (ipFamily === 'IPv6') {
    return translate('Service IPv6');
  }

  return translate('Service IP');
};

const resourceListStyle = kialiStyle({
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

export const ServiceNetwork: React.FC<ServiceNetworkProps> = (props: ServiceNetworkProps) => {
  const { t } = useKialiTranslation();

  const getPortOver = (portId: number): React.ReactNode => {
    return <ValidationList checks={getPortChecks(portId)} />;
  };

  const getPortChecks = (portId: number): ObjectCheck[] => {
    return props.validations ? props.validations.checks.filter(c => c.path === `spec/ports[${portId}]`) : [];
  };

  const hasIssue = (portId: number): boolean => {
    return getPortChecks(portId).length > 0;
  };

  const getHostnames = (virtualServices: VirtualService[]): HostnameInfo[] => {
    const hostnames: HostnameInfo[] = [];

    virtualServices.forEach(vs => {
      vs.spec.hosts?.forEach(host => {
        if (host === '*') {
          vs.spec.gateways?.forEach(vsGatewayName => {
            const vsGateways = props.gateways.filter(gateway => {
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
    for (const hostnameInfo of hostnames) {
      if (hostnameInfo.hostname === '*') {
        return [hostnameInfo];
      }
    }

    return hostnames;
  };

  const service = props.serviceDetails.service;
  const ips = service.type !== 'External' ? (service.ips ? service.ips : [service.ip]) : [];
  return (
    <Card isCompact={true} id="ServiceNetworkCard">
      <CardHeader>
        <Title headingLevel="h3" size={TitleSizes['xl']}>
          {t('Network')}
        </Title>
      </CardHeader>
      <CardBody>
        <div key="network-list" className={resourceListStyle}>
          <ul style={{ listStyleType: 'none' }}>
            <li>
              <span>{t('Type')}</span>
              {t(service.type)}
            </li>

            {ips.map((ip, i) => (
              <li key={`ip_${i}`}>
                <span>
                  {service.type !== 'ExternalName' ? getServiceIpLabel(service.ipFamilies?.[i], t) : t('ExternalName')}
                </span>
                {service.type !== 'ExternalName' ? ip : service.externalName ? service.externalName : ''}
              </li>
            ))}

            {props.serviceDetails.endpoints && props.serviceDetails.endpoints.length > 0 && (
              <li>
                <span>{t('Endpoints')}</span>
                <div style={{ display: 'inline-block' }}>
                  {(props.serviceDetails.endpoints ?? []).map((endpoint, i) => {
                    return (endpoint.addresses ?? []).map((address, u) => (
                      <div key={`endpoint_${i}_address_${u}`}>
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

            {service.ports && service.ports.length > 0 && (
              <li>
                <span>{t('Ports')}</span>
                <div style={{ display: 'inline-block' }}>
                  {(service.ports ?? []).map((port, i) => {
                    return (
                      <div key={`port_${i}`}>
                        <div>
                          <span style={{ marginRight: '0.5rem' }}>
                            {port.name} {port.port}
                          </span>
                          {hasIssue(i) ? getPortOver(i) : undefined}
                          {port.appProtocol && port.appProtocol !== '' ? (
                            <Tooltip
                              position={TooltipPosition.right}
                              content={
                                <div style={{ textAlign: 'left' }}>
                                  {t('App Protocol: {{protocol}}', { protocol: port.appProtocol })}
                                </div>
                              }
                            >
                              <span style={{ marginRight: '0.25rem' }}>
                                <KialiIcon.Info className={infoStyle} />
                              </span>
                            </Tooltip>
                          ) : undefined}
                        </div>
                        <div>({t(port.protocol)})</div>
                      </div>
                    );
                  })}
                </div>
              </li>
            )}

            {props.serviceDetails.virtualServices.length > 0 && (
              <li>
                <span>{t('Hostnames')}</span>
                <div style={{ display: 'inline-block' }}>
                  {getHostnames(props.serviceDetails.virtualServices).map((hostname, i) => {
                    return (
                      <div key={`hostname_${i}`} style={{ width: 'fit-content' }}>
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
};
