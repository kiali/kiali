import { Radio, Dropdown, DropdownToggle, Checkbox, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { TrafficRate, isGrpcRate, isHttpRate, isTcpRate } from '../../../types/Graph';
import { KialiAppAction } from 'actions/KialiAppAction';
import * as _ from 'lodash';
import { trafficRatesSelector } from 'store/Selectors';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import {
  containerStyle,
  infoStyle,
  itemStyleWithInfo,
  itemStyleWithoutInfo,
  menuStyle,
  menuEntryStyle
} from 'styles/DropdownStyles';

type ReduxProps = {
  trafficRates: TrafficRate[];
  setTrafficRates: (trafficRates: TrafficRate[]) => void;
};

type GraphTrafficProps = ReduxProps & {
  disabled: boolean;
};

type GraphTrafficState = { isOpen: boolean };

interface TrafficRateOptionType {
  id: string;
  disabled?: boolean;
  labelText: string;
  isChecked: boolean;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

class GraphTraffic extends React.PureComponent<GraphTrafficProps, GraphTrafficState> {
  constructor(props: GraphTrafficProps) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  private onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };

  render() {
    return (
      <Dropdown
        toggle={
          <DropdownToggle id="graph-traffic-dropdown" isDisabled={this.props.disabled} onToggle={this.onToggle}>
            Traffic
          </DropdownToggle>
        }
        isOpen={this.state.isOpen}
      >
        {this.getPopoverContent()}
      </Dropdown>
    );
  }

  private getPopoverContent() {
    const trafficRates = this.props.trafficRates;

    const trafficRateOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.GRPC_GROUP,
        labelText: _.startCase(TrafficRate.GRPC_GROUP),
        isChecked: trafficRates.includes(TrafficRate.GRPC_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Displays active gRPC Edges for the time period, using the selected gRPC rate. To see idle gRPC Edges enable
            the "Idle Edges" Display menu option. Default: Requests.
          </div>
        )
      },
      {
        id: TrafficRate.HTTP_GROUP,
        labelText: _.startCase(TrafficRate.HTTP_GROUP),
        isChecked: trafficRates.includes(TrafficRate.HTTP_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Displays active HTTP Edges for the time period, using the selected HTTP rate. To see idle HTTP Edges enable
            the "Idle Edges" Display menu option. Default: Requests.
          </div>
        )
      },
      {
        id: TrafficRate.TCP_GROUP,
        labelText: _.startCase(TrafficRate.TCP_GROUP),
        isChecked: trafficRates.includes(TrafficRate.TCP_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Displays active TCP Edges for the time period, using the selected TCP rate. To see inactive TCP Edges enable
            the "Idle Edges" Display menu option. Default: Sent Bytes.
          </div>
        )
      }
    ];

    const grpcOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.GRPC_RECEIVED,
        labelText: 'Received Messages',
        isChecked: trafficRates.includes(TrafficRate.GRPC_RECEIVED),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Received (i.e. Response) message rate in messages-per-second (mps). Captures server streaming RPCs.
          </div>
        )
      },
      {
        id: TrafficRate.GRPC_REQUEST,
        labelText: 'Requests',
        isChecked: trafficRates.includes(TrafficRate.GRPC_REQUEST),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Request message rate in requests-per-second (rps). Captures unary RPC, with status codes.
          </div>
        )
      },
      {
        id: TrafficRate.GRPC_SENT,
        labelText: 'Sent Messages',
        isChecked: trafficRates.includes(TrafficRate.GRPC_SENT),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Sent (i.e. Request) message rate in messages-per-second (mps). Captures client streaming RPCs.
          </div>
        )
      },
      {
        id: TrafficRate.GRPC_TOTAL,
        labelText: 'Total Messages',
        isChecked: trafficRates.includes(TrafficRate.GRPC_TOTAL),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Combined (Sent + Received) message rate in messages-per-second (mps). Captures all streaming RPCs.
          </div>
        )
      }
    ];

    const httpOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.HTTP_REQUEST,
        labelText: 'Requests',
        isChecked: trafficRates.includes(TrafficRate.HTTP_REQUEST),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Request message rate in requests-per-second (rps). Captures status codes.
          </div>
        )
      }
    ];

    const tcpOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.TCP_RECEIVED,
        labelText: 'Received Bytes',
        isChecked: trafficRates.includes(TrafficRate.TCP_RECEIVED),
        tooltip: <div style={{ textAlign: 'left' }}>Received bytes rate in bytes-per-second (bps).</div>
      },
      {
        id: TrafficRate.TCP_SENT,
        labelText: 'Sent Bytes',
        isChecked: trafficRates.includes(TrafficRate.TCP_SENT),
        tooltip: <div style={{ textAlign: 'left' }}>Sent bytes rate in bytes-per-second (bps).</div>
      },
      {
        id: TrafficRate.TCP_TOTAL,
        labelText: 'Total Bytes',
        isChecked: trafficRates.includes(TrafficRate.TCP_TOTAL),
        tooltip: (
          <div style={{ textAlign: 'left' }}>Combined (Sent + Received) byte rate in bytes-per-second (mps).</div>
        )
      }
    ];

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-traffic-menu" className={menuStyle} style={{ width: '16.5em' }}>
          {trafficRateOptions.map((trafficRateOption: TrafficRateOptionType) => (
            <div key={trafficRateOption.id} className={menuEntryStyle}>
              <label
                key={trafficRateOption.id}
                className={!!trafficRateOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
              >
                <Checkbox
                  id={trafficRateOption.id}
                  name="trafficRateOptions"
                  isChecked={trafficRateOption.isChecked}
                  isDisabled={this.props.disabled}
                  label={trafficRateOption.labelText}
                  onChange={this.toggleTrafficRate}
                  value={trafficRateOption.id}
                />
              </label>
              {!!trafficRateOption.tooltip && (
                <Tooltip
                  key={`tooltip_${trafficRateOption.id}`}
                  position={TooltipPosition.right}
                  content={trafficRateOption.tooltip}
                >
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
              {trafficRateOption.id === TrafficRate.GRPC_GROUP && grpcOptions.some(o => o.isChecked) && (
                <div>
                  {grpcOptions.map((grpcOption: TrafficRateOptionType) => (
                    <div key={grpcOption.id} className={menuEntryStyle}>
                      <label
                        key={grpcOption.id}
                        className={!!grpcOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '35px' }}
                      >
                        <Radio
                          id={grpcOption.id}
                          style={{ paddingLeft: '5px' }}
                          name="grpcOptions"
                          isChecked={grpcOption.isChecked}
                          isDisabled={this.props.disabled}
                          label={grpcOption.labelText}
                          onChange={this.toggleTrafficRateGrpc}
                          value={grpcOption.id}
                        />
                      </label>
                      {!!grpcOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${grpcOption.id}`}
                          position={TooltipPosition.right}
                          content={grpcOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {trafficRateOption.id === TrafficRate.HTTP_GROUP && httpOptions.some(o => o.isChecked) && (
                <div>
                  {httpOptions.map((httpOption: TrafficRateOptionType) => (
                    <div key={httpOption.id} className={menuEntryStyle}>
                      <label
                        key={httpOption.id}
                        className={!!httpOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '35px' }}
                      >
                        <Radio
                          id={httpOption.id}
                          style={{ paddingLeft: '5px' }}
                          name="httpOptions"
                          isChecked={httpOption.isChecked}
                          isDisabled={this.props.disabled}
                          label={httpOption.labelText}
                          onChange={this.toggleTrafficRateHttp}
                          value={httpOption.id}
                        />
                      </label>
                      {!!httpOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${httpOption.id}`}
                          position={TooltipPosition.right}
                          content={httpOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {trafficRateOption.id === TrafficRate.TCP_GROUP && tcpOptions.some(o => o.isChecked) && (
                <div>
                  {tcpOptions.map((tcpOption: TrafficRateOptionType) => (
                    <div key={tcpOption.id} className={menuEntryStyle}>
                      <label
                        key={tcpOption.id}
                        className={!!tcpOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '35px' }}
                      >
                        <Radio
                          id={tcpOption.id}
                          style={{ paddingLeft: '5px' }}
                          name="tcpOptions"
                          isChecked={tcpOption.isChecked}
                          isDisabled={this.props.disabled}
                          label={tcpOption.labelText}
                          onChange={this.toggleTrafficRateTcp}
                          value={tcpOption.id}
                        />
                      </label>
                      {!!tcpOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${tcpOption.id}`}
                          position={TooltipPosition.right}
                          content={tcpOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  }

  private toggleTrafficRate = (_, event) => {
    const rate = event.target.value as TrafficRate;
    if (this.props.trafficRates.includes(rate)) {
      let newRates;
      switch (rate) {
        case TrafficRate.GRPC_GROUP:
          newRates = this.props.trafficRates.filter(r => !isGrpcRate(r));
          break;
        case TrafficRate.HTTP_GROUP:
          newRates = this.props.trafficRates.filter(r => !isHttpRate(r));
          break;
        case TrafficRate.TCP_GROUP:
          newRates = this.props.trafficRates.filter(r => !isTcpRate(r));
          break;
        default:
          newRates = this.props.trafficRates.filter(r => r !== rate);
      }
      this.props.setTrafficRates(newRates);
    } else {
      switch (rate) {
        case TrafficRate.GRPC_GROUP:
          this.props.setTrafficRates([...this.props.trafficRates, rate, TrafficRate.GRPC_REQUEST]);
          break;
        case TrafficRate.HTTP_GROUP:
          this.props.setTrafficRates([...this.props.trafficRates, rate, TrafficRate.HTTP_REQUEST]);
          break;
        case TrafficRate.TCP_GROUP:
          this.props.setTrafficRates([...this.props.trafficRates, rate, TrafficRate.TCP_SENT]);
          break;
        default:
          this.props.setTrafficRates([...this.props.trafficRates, rate]);
      }
    }
  };

  private toggleTrafficRateGrpc = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = this.props.trafficRates.filter(r => !isGrpcRate(r));
    this.props.setTrafficRates([...newRates, TrafficRate.GRPC_GROUP, rate]);
  };

  private toggleTrafficRateHttp = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = this.props.trafficRates.filter(r => !isHttpRate(r));
    this.props.setTrafficRates([...newRates, TrafficRate.HTTP_GROUP, rate]);
  };

  private toggleTrafficRateTcp = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = this.props.trafficRates.filter(r => !isTcpRate(r));
    this.props.setTrafficRates([...newRates, TrafficRate.TCP_GROUP, rate]);
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  trafficRates: trafficRatesSelector(state)
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setTrafficRates: bindActionCreators(GraphToolbarActions.setTrafficRates, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
const GraphTrafficContainer = connect(mapStateToProps, mapDispatchToProps)(GraphTraffic);
export default GraphTrafficContainer;
