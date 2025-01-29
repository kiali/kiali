import * as React from 'react';
import { Button, ButtonVariant, Modal, Split, SplitItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { AccessLog } from 'types/IstioObjects';
import { PFColors } from 'components/Pf/PfColors';
import { classes } from 'typestyle';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

export interface AccessLogModalProps {
  accessLog: AccessLog;
  accessLogMessage: string;
  className?: string;
  isWaypoint: boolean;
  isZtunnel: boolean;
  onClose?: () => void;
}

const fieldStyle = kialiStyle({
  color: PFColors.Orange400,
  fontWeight: 'bold',
  paddingLeft: 0,
  paddingRight: 0
});

const modalStyle = kialiStyle({
  height: '70%',
  width: '50%',
  overflow: 'auto',
  overflowY: 'hidden'
});

const prefaceStyle = kialiStyle({
  fontFamily: 'monospace',
  fontSize: 'var(--kiali-global--font-size)',
  backgroundColor: PFColors.Black1000,
  color: PFColors.Gold400,
  marginBottom: '1rem',
  overflow: 'auto',
  resize: 'none',
  padding: '0.75rem',
  whiteSpace: 'pre'
});

const splitStyle = kialiStyle({
  overflow: 'auto',
  width: '50%'
});

const contentStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginRight: '0.5rem'
});

const descriptionStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor200,
  padding: '1rem 1.25rem',
  $nest: {
    '& dt': {
      fontWeight: 'bold'
    }
  }
});

const tableStyle = kialiStyle({
  background: 'transparent',
  marginBottom: '0.25rem',
  $nest: {
    '& tbody tr:last-child': {
      borderBottom: 0
    },
    '& tr > *': {
      padding: '0.25rem'
    }
  }
});

export const AccessLogModal: React.FC<AccessLogModalProps> = (props: AccessLogModalProps) => {
  const [description, setDescription] = React.useState<React.ReactNode>(
    <div style={{ width: '100%', textAlign: 'center' }}>
      <dt>Click Field Name for Description</dt>
    </div>
  );

  const accessLogContent = (al: AccessLog): React.ReactNode => {
    return (
      <div style={{ textAlign: 'left' }}>
        {accessLogField('authority', al.authority)}
        {accessLogField('bytes received', al.bytes_received)}
        {accessLogField('bytes sent', al.bytes_sent)}
        {accessLogField('downstream local', al.downstream_local)}
        {accessLogField('downstream remote', al.downstream_remote)}
        {accessLogField('duration', al.duration)}
        {accessLogField('forwarded for', al.forwarded_for)}
        {accessLogField('method', al.method)}
        {accessLogField('protocol', al.protocol)}
        {accessLogField('request id', al.request_id)}
        {accessLogField('requested server', al.requested_server)}
        {accessLogField('response flags', al.response_flags)}
        {accessLogField('route name', al.route_name)}
        {accessLogField('status code', al.status_code)}
        {accessLogField('tcp service time', al.tcp_service_time)}
        {accessLogField('timestamp', al.timestamp)}
        {accessLogField('upstream cluster', al.upstream_cluster)}
        {accessLogField('upstream failure reason', al.upstream_failure_reason)}
        {accessLogField('upstream local', al.upstream_local)}
        {accessLogField('upstream service', al.upstream_service)}
        {accessLogField('upstream service time', al.upstream_service_time)}
        {accessLogField('uri param', al.uri_param)}
        {accessLogField('uri path', al.uri_path)}
        {accessLogField('user agent', al.user_agent)}
      </div>
    );
  };

  const accessLogField = (key: string, val: string): React.ReactNode => {
    return (
      <>
        <Button key={key} className={fieldStyle} variant={ButtonVariant.link} onClick={() => handleClick(key)}>
          {key}:&nbsp;
        </Button>
        <span>{val ? val : '-'}</span>
        <br />
      </>
    );
  };

  const handleClick = (alFieldName: string): void => {
    setDescription(getDescription(alFieldName));
  };

  const getDescription = (alFieldName: string): React.ReactNode => {
    switch (alFieldName) {
      case 'authority':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Authority is the request authority header %REQ(:AUTHORITY)%</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'bytes received':
        return (
          <>
            <dt>%BYTES_RECEIVED%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Body bytes received.</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Downstream bytes received on connection.</p>
                </dd>
              </dl>
              <p>Renders a numeric value in typed JSON logs.</p>
            </dd>
          </>
        );
      case 'bytes sent':
        return (
          <>
            <dt>%BYTES_SENT%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Body bytes sent. For WebSocket connection it will also include response header bytes.</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Downstream bytes sent on connection.</p>
                </dd>
              </dl>
              <p>Renders a numeric value in typed JSON logs.</p>
            </dd>
          </>
        );
      case 'downstream local':
        return (
          <>
            <dt>%DOWNSTREAM_LOCAL_ADDRESS%</dt>
            <dd>
              <p>
                Local address of the downstream connection. If the address is an IP address it includes both address and
                port. If the original connection was redirected by iptables REDIRECT, this represents the original
                destination address restored by the{' '}
                <a
                  className="reference external"
                  href="https://www.envoyproxy.io/docs/envoy/latest/configuration/listeners/listener_filters/original_dst_filter"
                >
                  <span className="std std-ref">Original Destination Filter</span>
                </a>{' '}
                using SO_ORIGINAL_DST socket option. If the original connection was redirected by iptables TPROXY, and
                the listener’s transparent option was set to true, this represents the original destination address and
                port.
              </p>
            </dd>
          </>
        );
      case 'downstream remote':
        return (
          <>
            <dt>%DOWNSTREAM_REMOTE_ADDRESS%</dt>
            <dd>
              <p>
                Remote address of the downstream connection. If the address is an IP address it includes both address
                and port.
              </p>
              <div className="admonition note">
                <p className="admonition-title">Note</p>
                <p>
                  This may not be the physical remote address of the peer if the address has been inferred from{' '}
                  <a
                    className="reference external"
                    href="https://www.envoyproxy.io/docs/envoy/latest/configuration/listeners/listener_filters/proxy_protocol"
                  >
                    <span className="std std-ref">Proxy Protocol filter</span>
                  </a>{' '}
                  or{' '}
                  <a
                    className="reference external"
                    href="https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_conn_man/headers#config-http-conn-man-headers-x-forwarded-for"
                  >
                    <span className="std std-ref">x-forwarded-for</span>
                  </a>
                  .
                </p>
              </div>
            </dd>
          </>
        );
      case 'duration':
        return (
          <>
            <dt>%DURATION%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Total duration in milliseconds of the request from the start time to the last byte out.</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Total duration in milliseconds of the downstream connection.</p>
                </dd>
              </dl>
              <p>Renders a numeric value in typed JSON logs.</p>
            </dd>
          </>
        );
      case 'forwarded for':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>ForwardedFor is the X-Forwarded-For header value %REQ(FORWARDED-FOR)%</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'method':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Method is the HTTP method %REQ(:METHOD)%</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'protocol':
        return (
          <>
            <dt>%PROTOCOL%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>
                    Protocol. Currently either <em>HTTP/1.1</em> or <em>HTTP/2</em>.
                  </p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
              <p>
                In typed JSON logs, PROTOCOL will render the string{' '}
                <code className="docutils literal notranslate">
                  <span className="pre">&quot;-&quot;</span>
                </code>{' '}
                if the protocol is not available (e.g. in TCP logs).
              </p>
            </dd>
          </>
        );
      case 'request id':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>RequestId is the envoy generated X-REQUEST-ID header "%REQ(X-REQUEST-ID)%"</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'requested server':
        return (
          <>
            <dt>%REQUESTED_SERVER_NAME%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>String value set on ssl connection socket for Server Name Indication (SNI)</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>String value set on ssl connection socket for Server Name Indication (SNI)</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'response flags':
        return (
          <>
            <dt>%RESPONSE_FLAGS%</dt>
            <dd>
              <p>
                Additional details about the response or connection, if any. For TCP connections, the response codes
                mentioned in the descriptions do not apply. Possible values are:
              </p>
              <dl className="simple">
                <dt>HTTP and TCP</dt>
                <dd>
                  <ul className="simple">
                    <li>
                      <p>
                        <strong>UH</strong>: No healthy upstream hosts in upstream cluster in addition to 503 response
                        code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UF</strong>: Upstream connection failure in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UO</strong>: Upstream overflow (
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking"
                        >
                          <span className="std std-ref">circuit breaking</span>
                        </a>
                        ) in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>NR</strong>: No{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing"
                        >
                          <span className="std std-ref">route configured</span>
                        </a>{' '}
                        for a given request in addition to 404 response code, or no matching filter chain for a
                        downstream connection.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>URX</strong>: The request was rejected because the{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/route/v3/route_components.proto#envoy-v3-api-field-config-route-v3-retrypolicy-num-retries"
                        >
                          <span className="std std-ref">upstream retry limit (HTTP)</span>
                        </a>{' '}
                        or{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/network/tcp_proxy/v3/tcp_proxy.proto#envoy-v3-api-field-extensions-filters-network-tcp-proxy-v3-tcpproxy-max-connect-attempts"
                        >
                          <span className="std std-ref">maximum connect attempts (TCP)</span>
                        </a>{' '}
                        was reached.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>NC</strong>: Upstream cluster not found.
                      </p>
                    </li>
                  </ul>
                </dd>
                <dt>HTTP only</dt>
                <dd>
                  <ul className="simple">
                    <li>
                      <p>
                        <strong>DC</strong>: Downstream connection termination.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>LH</strong>: Local service failed{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/health_checking"
                        >
                          <span className="std std-ref">health check request</span>
                        </a>{' '}
                        in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UT</strong>: Upstream request timeout in addition to 504 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>LR</strong>: Connection local reset in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UR</strong>: Upstream remote reset in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UC</strong>: Upstream connection termination in addition to 503 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>DI</strong>: The request processing was delayed for a period specified via{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/fault_filter"
                        >
                          <span className="std std-ref">fault injection</span>
                        </a>
                        .
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>FI</strong>: The request was aborted with a response code specified via{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/fault_filter"
                        >
                          <span className="std std-ref">fault injection</span>
                        </a>
                        .
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>RL</strong>: The request was ratelimited locally by the{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter"
                        >
                          <span className="std std-ref">HTTP rate limit filter</span>
                        </a>{' '}
                        in addition to 429 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UAEX</strong>: The request was denied by the external authorization service.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>RLSE</strong>: The request was rejected because there was an error in rate limit
                        service.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>IH</strong>: The request was rejected because it set an invalid value for a{' '}
                        <a
                          className="reference external"
                          href="https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/http/router/v3/router.proto#envoy-v3-api-field-extensions-filters-http-router-v3-router-strict-check-headers"
                        >
                          <span className="std std-ref">strictly-checked header</span>
                        </a>{' '}
                        in addition to 400 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>SI</strong>: Stream idle timeout in addition to 408 response code.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>DPE</strong>: The downstream request had an HTTP protocol error.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UPE</strong>: The upstream response had an HTTP protocol error.
                      </p>
                    </li>
                    <li>
                      <p>
                        <strong>UMSDR</strong>: The upstream request reached to max stream duration.
                      </p>
                    </li>
                  </ul>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'route name':
        return (
          <>
            <dt>%ROUTE_NAME%</dt>
            <dd>
              <p>RouteName is the name of the VirtualService route which matched this request %ROUTE_NAME%</p>
            </dd>
          </>
        );
      case 'status code':
        return (
          <>
            <dt>%RESPONSE_CODE%</dt>
            <dd>
              <dl>
                <dt>HTTP</dt>
                <dd>
                  <p>
                    HTTP response code. Note that a response code of ‘0’ means that the server never sent the beginning
                    of a response. This generally means that the (downstream) client disconnected.
                  </p>
                  <p>
                    Note that in the case of 100-continue responses, only the response code of the final headers will be
                    logged. If a 100-continue is followed by a 200, the logged response will be 200. If a 100-continue
                    results in a disconnect, the 100 will be logged.
                  </p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
              <p>Renders a numeric value in typed JSON logs.</p>
            </dd>
          </>
        );
      case 'tcp service time':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>
                    TCPServiceTime is the X-ENVOY-UPSTREAM-SERVICE-TIME header "%REQ(X-ENVOY-UPSTREAM-SERVICE-TIME)%"
                  </p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'timestamp':
        return (
          <>
            <dt>%START_TIME%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>Request start time including milliseconds.</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Downstream connection start time including milliseconds.</p>
                </dd>
              </dl>
              <p>
                START_TIME can be customized using a{' '}
                <a className="reference external" href="https://en.cppreference.com/w/cpp/io/manip/put_time">
                  format string
                </a>
                . In addition to that, START_TIME also accepts following specifiers:
              </p>
              <Table className={tableStyle}>
                <Thead>
                  <Tr className="row-odd">
                    <Th dataLabel="Specifier" width={30} className="head">
                      <p>Specifier</p>
                    </Th>
                    <Th dataLabel="Explanation" width={70} className="head">
                      <p>Explanation</p>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr className="row-even">
                    <Td>
                      <p>
                        <code className="docutils literal notranslate">
                          <span className="pre">%s</span>
                        </code>
                      </p>
                    </Td>
                    <Td>
                      <p>The number of seconds since the Epoch</p>
                    </Td>
                  </Tr>
                  <Tr className="row-odd">
                    <Td rowSpan={2}>
                      <p>
                        <code className="docutils literal notranslate">
                          <span className="pre">%f</span>
                        </code>
                        ,{' '}
                        <code className="docutils literal notranslate">
                          <span className="pre">%[1-9]f</span>
                        </code>
                      </p>
                    </Td>
                    <Td>
                      <p>Fractional seconds digits, default is 9 digits (nanosecond)</p>
                    </Td>
                  </Tr>
                  <Tr className="row-even">
                    <Td>
                      <ul className="simple">
                        <li>
                          <p>
                            <code className="docutils literal notranslate">
                              <span className="pre">%3f</span>
                            </code>{' '}
                            millisecond (3 digits)
                          </p>
                        </li>
                        <li>
                          <p>
                            <code className="docutils literal notranslate">
                              <span className="pre">%6f</span>
                            </code>{' '}
                            microsecond (6 digits)
                          </p>
                        </li>
                        <li>
                          <p>
                            <code className="docutils literal notranslate">
                              <span className="pre">%9f</span>
                            </code>{' '}
                            nanosecond (9 digits)
                          </p>
                        </li>
                      </ul>
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
              <p>Examples of formatting START_TIME is as follows:</p>
              <div className="highlight-none notranslate">
                <div className="highlight">
                  <pre>
                    <span></span>%START_TIME(%Y/%m/%dT%H:%M:%S%z %s)% # To include millisecond fraction of the second
                    (.000 ... .999). E.g. 1527590590.528. %START_TIME(%s.%3f)% %START_TIME(%s.%6f)% %START_TIME(%s.%9f)%
                  </pre>
                </div>
              </div>
              <p>In typed JSON logs, START_TIME is always rendered as a string.</p>
            </dd>
          </>
        );
      case 'upstream cluster':
        return (
          <>
            <dt>%UPSTREAM_CLUSTER%</dt>
            <dd>
              <p>
                Upstream cluster to which the upstream host belongs to. If runtime feature
                <cite>envoy.reloadable_features.use_observable_cluster_name</cite> is enabled, then{' '}
                <a
                  className="reference external"
                  href="https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/cluster/v3/cluster.proto#envoy-v3-api-field-config-cluster-v3-cluster-alt-stat-name"
                >
                  <span className="std std-ref">alt_stat_name</span>
                </a>{' '}
                will be used if provided.
              </p>
            </dd>
          </>
        );
      case 'upstream failure reason':
        return (
          <>
            <dt>%UPSTREAM_TRANSPORT_FAILURE_REASON%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>
                    If upstream connection failed due to transport socket (e.g. TLS handshake), provides the failure
                    reason from the transport socket. The format of this field depends on the configured upstream
                    transport socket. Common TLS failures are in{' '}
                    <a
                      className="reference external"
                      href="https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/security/ssl#trouble-shooting"
                    >
                      <span className="std std-ref">TLS trouble shooting</span>
                    </a>
                    .
                  </p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“)</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'upstream local':
        return (
          <>
            <dt>%UPSTREAM_LOCAL_ADDRESS%</dt>
            <dd>
              <p>
                Local address of the upstream connection. If the address is an IP address it includes both address and
                port.
              </p>
            </dd>
          </>
        );
      case 'upstream service':
        return (
          <>
            <dt>%UPSTREAM_HOST%</dt>
            <dd>
              <p>
                Upstream host URL (e.g.,{' '}
                <a className="reference external" href="tcp://ip:port">
                  tcp://ip:port
                </a>{' '}
                for TCP connections).
              </p>
            </dd>
          </>
        );
      case 'uri path':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>An HTTP request header: "%REQ(X-ENVOY-ORIGINAL-PATH?):PATH"</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      case 'user agent':
        return (
          <>
            <dt>%REQ(X?Y):Z%</dt>
            <dd>
              <dl className="simple">
                <dt>HTTP</dt>
                <dd>
                  <p>An HTTP request header: "%REQ(USER-AGENT)</p>
                </dd>
                <dt>TCP</dt>
                <dd>
                  <p>Not implemented (“-“).</p>
                </dd>
              </dl>
            </dd>
          </>
        );
      default:
        return <>No documentation available</>;
    }
  };
  return (
    <Modal
      className={modalStyle}
      disableFocusTrap={true}
      title={
        props.isZtunnel
          ? 'ztunnel Access Log Entry'
          : props.isWaypoint
          ? 'Waypoint Access log Entry'
          : 'Envoy Access Log Entry'
      }
      isOpen={true}
      onClose={props.onClose}
    >
      <div style={{ height: '85%' }}>
        <div className={prefaceStyle}>{props.accessLogMessage} </div>
        <Split style={{ height: '100%' }}>
          <SplitItem className={classes(splitStyle, contentStyle)}>{accessLogContent(props.accessLog)}</SplitItem>
          <SplitItem className={classes(splitStyle, descriptionStyle)}>{description}</SplitItem>
        </Split>
      </div>
    </Modal>
  );
};
