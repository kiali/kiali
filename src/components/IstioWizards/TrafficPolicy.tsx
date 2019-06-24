import * as React from 'react';
import { connect } from 'react-redux';
import {
  Col,
  ControlLabel,
  DropdownButton,
  Form,
  FormControl,
  FormGroup,
  HelpBlock,
  Icon,
  MenuItem,
  Radio,
  Switch
} from 'patternfly-react';
import { MTLSStatuses, nsWideMTLSStatus, TLSStatus } from '../../types/TLSStatus';
import { KialiAppState } from '../../store/Store';
import { meshWideMTLSStatusSelector } from '../../store/Selectors';
import { HTTPCookie, LoadBalancerSettings } from '../../types/IstioObjects';
import { style } from 'typestyle';

export const DISABLE = 'DISABLE';
export const ISTIO_MUTUAL = 'ISTIO_MUTUAL';
export const ROUND_ROBIN = 'ROUND_ROBIN';

export const loadBalancerSimple: string[] = [ROUND_ROBIN, 'LEAST_CONN', 'RANDOM', 'PASSTHROUGH'];

export const mTLSMode: string[] = [DISABLE, ISTIO_MUTUAL, 'SIMPLE'];

type ReduxProps = {
  meshWideStatus: string;
};

type Props = ReduxProps & {
  mtlsMode: string;
  hasLoadBalancer: boolean;
  loadBalancer: LoadBalancerSettings;
  onTrafficPolicyChange: (valid: boolean, trafficPolicy: TrafficPolicyState) => void;
  nsWideStatus?: TLSStatus;
};

export enum ConsistentHashType {
  HTTP_HEADER_NAME = 'HTTP_HEADER_NAME',
  HTTP_COOKIE = 'HTTP_COOKIE',
  USE_SOURCE_IP = 'USE_SOURCE_IP'
}

export type TrafficPolicyState = {
  tlsModified: boolean;
  mtlsMode: string;
  addLoadBalancer: boolean;
  simpleLB: boolean;
  consistentHashType: ConsistentHashType;
  loadBalancer: LoadBalancerSettings;
};

const tlsIconType = 'pf';
const tlsIconName = 'locked';

const durationRegex = /^[0-9]*(\.[0-9]+)?s?$/;

enum TrafficPolicyForm {
  TLS,
  LB_SWITCH,
  LB_SIMPLE,
  LB_SELECT,
  LB_CONSISTENT_HASH,
  LB_HTTP_HEADER_NAME,
  LB_HTTP_COOKIE_NAME,
  LB_HTTP_COOKIE_TTL
}

const labelStyle = style({
  marginTop: 20
});

class TrafficPolicy extends React.Component<Props, TrafficPolicyState> {
  constructor(props: Props) {
    super(props);
    let consistentHashType: ConsistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
    if (props.loadBalancer.consistentHash) {
      if (props.loadBalancer.consistentHash.httpHeaderName) {
        consistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
      } else if (props.loadBalancer.consistentHash.httpCookie) {
        consistentHashType = ConsistentHashType.HTTP_COOKIE;
      } else if (props.loadBalancer.consistentHash.useSourceIp) {
        consistentHashType = ConsistentHashType.USE_SOURCE_IP;
      }
    }
    this.state = {
      tlsModified: false,
      mtlsMode: props.mtlsMode,
      addLoadBalancer: props.hasLoadBalancer,
      simpleLB: props.loadBalancer && props.loadBalancer.simple !== undefined && props.loadBalancer.simple !== null,
      consistentHashType: consistentHashType,
      loadBalancer: props.loadBalancer
    };
  }

  componentDidMount(): void {
    const meshWideStatus = this.props.meshWideStatus || MTLSStatuses.NOT_ENABLED;
    const nsWideStatus = this.props.nsWideStatus ? this.props.nsWideStatus.status : MTLSStatuses.NOT_ENABLED;
    const isMtlsEnabled = nsWideMTLSStatus(nsWideStatus, meshWideStatus);
    if (isMtlsEnabled === MTLSStatuses.ENABLED) {
      this.setState(
        {
          tlsModified: true,
          mtlsMode: ISTIO_MUTUAL
        },
        () => this.props.onTrafficPolicyChange(true, this.state)
      );
    } else if (this.props.mtlsMode !== '' && this.props.mtlsMode !== DISABLE) {
      // Don't forget to update the mtlsMode
      this.setState(
        {
          tlsModified: true,
          mtlsMode: this.props.mtlsMode
        },
        () => this.props.onTrafficPolicyChange(true, this.state)
      );
    }
  }

  isValidDuration = (ttl: string): boolean => {
    if (ttl.length === 0) {
      return false;
    }
    return ttl.search(durationRegex) === 0;
  };

  isValidCookie = (cookie: HTTPCookie): boolean => {
    if (
      !cookie.name ||
      cookie.name.length === 0 ||
      !cookie.ttl ||
      cookie.ttl.length === 0 ||
      !this.isValidDuration(cookie.ttl)
    ) {
      return false;
    }
    return true;
  };

  isValidLB = (state: TrafficPolicyState): boolean => {
    if (!state.addLoadBalancer) {
      return true;
    }
    if (state.simpleLB) {
      // No need to check more as user select the simple LB from a list
      return true;
    }
    // No need to enter to check inside consistentHash
    if (state.consistentHashType === ConsistentHashType.USE_SOURCE_IP) {
      return true;
    }
    if (!state.loadBalancer.consistentHash) {
      return false;
    }
    switch (state.consistentHashType) {
      case ConsistentHashType.HTTP_HEADER_NAME:
        return state.loadBalancer.consistentHash && state.loadBalancer.consistentHash.httpHeaderName
          ? state.loadBalancer.consistentHash.httpHeaderName.length > 0
          : false;
      case ConsistentHashType.HTTP_COOKIE:
        return state.loadBalancer.consistentHash && state.loadBalancer.consistentHash.httpCookie
          ? this.isValidCookie(state.loadBalancer.consistentHash.httpCookie)
          : false;
      default:
        return true;
    }
  };

  onFormChange = (component: TrafficPolicyForm, value: string) => {
    switch (component) {
      case TrafficPolicyForm.TLS:
        this.setState(
          {
            tlsModified: true,
            mtlsMode: value
          },
          () => this.props.onTrafficPolicyChange(true, this.state)
        );
        break;
      case TrafficPolicyForm.LB_SWITCH:
        this.setState(
          prevState => {
            return {
              addLoadBalancer: !prevState.addLoadBalancer
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_SIMPLE:
        this.setState(
          prevState => {
            const loadBalancer = prevState.loadBalancer;
            loadBalancer.simple = value;
            return {
              loadBalancer: loadBalancer
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_SELECT:
        this.setState(
          prevState => {
            // Set a LB simple default value if not present
            if (!prevState.loadBalancer || !prevState.loadBalancer.simple) {
              prevState.loadBalancer.simple = ROUND_ROBIN;
            }
            return {
              simpleLB: value === 'true'
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_CONSISTENT_HASH:
        this.setState(
          prevState => {
            const loadBalancer = prevState.loadBalancer;
            if (!loadBalancer.consistentHash) {
              loadBalancer.consistentHash = {};
            }
            if (ConsistentHashType[value] === ConsistentHashType.USE_SOURCE_IP) {
              loadBalancer.consistentHash.useSourceIp = true;
            }
            return {
              consistentHashType: ConsistentHashType[value]
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_HTTP_HEADER_NAME:
        this.setState(
          prevState => {
            const loadBalancer = prevState.loadBalancer;
            if (!loadBalancer.consistentHash) {
              loadBalancer.consistentHash = {};
            }
            loadBalancer.consistentHash.httpHeaderName = value;
            return {
              loadBalancer: loadBalancer
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_HTTP_COOKIE_NAME:
        this.setState(
          prevState => {
            const loadBalancer = prevState.loadBalancer;
            if (!loadBalancer.consistentHash) {
              loadBalancer.consistentHash = {};
            } else {
              if (!loadBalancer.consistentHash.httpCookie) {
                loadBalancer.consistentHash.httpCookie = {
                  name: '',
                  ttl: ''
                };
              } else {
                loadBalancer.consistentHash.httpCookie.name = value;
              }
            }
            return {
              loadBalancer: loadBalancer
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      case TrafficPolicyForm.LB_HTTP_COOKIE_TTL:
        this.setState(
          prevState => {
            const consistentHash = prevState.loadBalancer ? prevState.loadBalancer.consistentHash : {};
            if (consistentHash) {
              if (!consistentHash.httpCookie) {
                consistentHash.httpCookie = {
                  name: '',
                  ttl: ''
                };
              } else {
                consistentHash.httpCookie.ttl = value;
              }
            }
            return {
              loadBalancer: {
                consistentHash: consistentHash
              }
            };
          },
          () => this.props.onTrafficPolicyChange(this.isValidLB(this.state), this.state)
        );
        break;
      default:
      // No default action
    }
  };

  render() {
    const tlsMenuItems: any[] = mTLSMode.map(mode => (
      <MenuItem key={mode} eventKey={mode} active={mode === this.props.mtlsMode}>
        {mode}
      </MenuItem>
    ));
    const lbMenuItems: any[] = loadBalancerSimple.map(simple => {
      const simpleLoadBalancer =
        this.state.loadBalancer && this.state.loadBalancer.simple ? this.state.loadBalancer.simple : '';
      return (
        <MenuItem key={simple} eventKey={simple} active={simple === simpleLoadBalancer}>
          {simple}
        </MenuItem>
      );
    });
    const isValidLB = this.isValidLB(this.state);
    return (
      <Form horizontal={true} onSubmit={e => e.preventDefault()}>
        <FormGroup controlId="tls" disabled={false}>
          <Col componentClass={ControlLabel} sm={3}>
            <Icon type={tlsIconType} name={tlsIconName} /> TLS
          </Col>
          <Col sm={9}>
            <DropdownButton
              bsStyle="default"
              title={this.state.mtlsMode}
              id="trafficPolicy-tls"
              onSelect={(mtlsMode: string) => this.onFormChange(TrafficPolicyForm.TLS, mtlsMode)}
            >
              {tlsMenuItems}
            </DropdownButton>
          </Col>
        </FormGroup>
        <FormGroup controlId="loadBalancerSwitch" disabled={false}>
          <Col componentClass={ControlLabel} sm={3}>
            Add LoadBalancer
          </Col>
          <Col sm={9}>
            <Switch
              bsSize="normal"
              title="normal"
              id="loadbalanacer-form"
              animate={false}
              onChange={() => this.onFormChange(TrafficPolicyForm.LB_SWITCH, '')}
              defaultValue={this.state.addLoadBalancer}
            />
          </Col>
        </FormGroup>
        {this.state.addLoadBalancer && (
          <>
            <FormGroup>
              <Col sm={3} />
              <Col sm={9}>
                <Radio
                  name="selectLBType"
                  className={labelStyle}
                  disabled={!this.state.addLoadBalancer}
                  checked={this.state.simpleLB}
                  onChange={() => this.onFormChange(TrafficPolicyForm.LB_SELECT, 'true')}
                  inline={true}
                >
                  Simple
                </Radio>
                <Radio
                  name="selectLBType"
                  className={labelStyle}
                  disabled={!this.state.addLoadBalancer}
                  checked={!this.state.simpleLB}
                  onChange={() => this.onFormChange(TrafficPolicyForm.LB_SELECT, 'false')}
                  inline={true}
                >
                  Consistent Hash
                </Radio>
              </Col>
            </FormGroup>
            {this.state.simpleLB && (
              <FormGroup controlId="loadBalancer" disabled={false}>
                <Col componentClass={ControlLabel} sm={3}>
                  LoadBalancer
                </Col>
                <Col sm={9}>
                  <DropdownButton
                    bsStyle="default"
                    title={this.state.loadBalancer.simple}
                    id="trafficPolicy-lb"
                    onSelect={(simple: string) => this.onFormChange(TrafficPolicyForm.LB_SIMPLE, simple)}
                  >
                    {lbMenuItems}
                  </DropdownButton>
                </Col>
              </FormGroup>
            )}
            {!this.state.simpleLB && (
              <>
                <FormGroup>
                  <Col sm={3} />
                  <Col sm={9}>
                    <Radio
                      name="selectConsistentHashType"
                      className={labelStyle}
                      disabled={!this.state.addLoadBalancer}
                      checked={this.state.consistentHashType === ConsistentHashType.HTTP_HEADER_NAME}
                      onChange={() =>
                        this.onFormChange(TrafficPolicyForm.LB_CONSISTENT_HASH, ConsistentHashType.HTTP_HEADER_NAME)
                      }
                      inline={true}
                    >
                      HTTP Header Name
                    </Radio>
                    <Radio
                      name="selectConsistentHashType"
                      className={labelStyle}
                      disabled={!this.state.addLoadBalancer}
                      checked={this.state.consistentHashType === ConsistentHashType.HTTP_COOKIE}
                      onChange={() =>
                        this.onFormChange(TrafficPolicyForm.LB_CONSISTENT_HASH, ConsistentHashType.HTTP_COOKIE)
                      }
                      inline={true}
                    >
                      HTTP Cookie
                    </Radio>
                    <Radio
                      name="selectConsistentHashType"
                      className={labelStyle}
                      disabled={!this.state.addLoadBalancer}
                      checked={this.state.consistentHashType === ConsistentHashType.USE_SOURCE_IP}
                      onChange={() =>
                        this.onFormChange(TrafficPolicyForm.LB_CONSISTENT_HASH, ConsistentHashType.USE_SOURCE_IP)
                      }
                      inline={true}
                    >
                      Source IP
                    </Radio>
                  </Col>
                </FormGroup>
                {this.state.consistentHashType === ConsistentHashType.HTTP_HEADER_NAME && (
                  <FormGroup
                    controlId="httpHeaderName"
                    disabled={!this.state.addLoadBalancer}
                    validationState={isValidLB ? null : 'error'}
                  >
                    <Col componentClass={ControlLabel} sm={3}>
                      HTTP Header Name
                    </Col>
                    <Col sm={9}>
                      <FormControl
                        type="text"
                        disabled={!this.state.addLoadBalancer}
                        value={
                          this.state.loadBalancer.consistentHash
                            ? this.state.loadBalancer.consistentHash.httpHeaderName
                            : ''
                        }
                        onChange={e => this.onFormChange(TrafficPolicyForm.LB_HTTP_HEADER_NAME, e.target.value)}
                      />
                    </Col>
                  </FormGroup>
                )}
                {this.state.consistentHashType === ConsistentHashType.HTTP_COOKIE && (
                  <>
                    <FormGroup
                      controlId="httpCookieName"
                      disabled={!this.state.addLoadBalancer}
                      validationState={isValidLB ? null : 'error'}
                    >
                      <Col componentClass={ControlLabel} sm={3}>
                        HTTP Cookie Name
                      </Col>
                      <Col sm={9}>
                        <FormControl
                          type="text"
                          disabled={!this.state.addLoadBalancer}
                          value={
                            this.state.loadBalancer.consistentHash && this.state.loadBalancer.consistentHash.httpCookie
                              ? this.state.loadBalancer.consistentHash.httpCookie.name
                              : ''
                          }
                          onChange={e => this.onFormChange(TrafficPolicyForm.LB_HTTP_COOKIE_NAME, e.target.value)}
                        />
                      </Col>
                    </FormGroup>
                    <FormGroup
                      controlId="httpCookieTtl"
                      disabled={!this.state.addLoadBalancer}
                      validationState={isValidLB ? null : 'error'}
                    >
                      <Col componentClass={ControlLabel} sm={3}>
                        HTTP Cookie TTL
                      </Col>
                      <Col sm={9}>
                        <FormControl
                          type="text"
                          disabled={!this.state.addLoadBalancer}
                          value={
                            this.state.loadBalancer.consistentHash && this.state.loadBalancer.consistentHash.httpCookie
                              ? this.state.loadBalancer.consistentHash.httpCookie.ttl
                              : ''
                          }
                          onChange={e => this.onFormChange(TrafficPolicyForm.LB_HTTP_COOKIE_TTL, e.target.value)}
                        />
                        <HelpBlock>
                          TTL is expressed in nanoseconds (i.e. 1000, 2000, etc) or seconds (i.e. 10s, 1.5s, etc).
                        </HelpBlock>
                      </Col>
                    </FormGroup>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Form>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  meshWideStatus: meshWideMTLSStatusSelector(state)
});

const TraffiPolicyContainer = connect(mapStateToProps)(TrafficPolicy);
export default TraffiPolicyContainer;
