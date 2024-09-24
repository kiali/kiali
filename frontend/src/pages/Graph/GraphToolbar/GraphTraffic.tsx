import {
  Radio,
  Checkbox,
  Tooltip,
  TooltipPosition,
  Dropdown,
  DropdownList,
  MenuToggleElement,
  MenuToggle
} from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { TrafficRate, isAmbientRate, isGrpcRate, isHttpRate, isTcpRate } from '../../../types/Graph';
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
  setTrafficRates: (trafficRates: TrafficRate[]) => void;
  trafficRates: TrafficRate[];
};

type GraphTrafficProps = ReduxProps & {
  disabled: boolean;
};

interface TrafficRateOptionType {
  disabled?: boolean;
  id: string;
  isChecked: boolean;
  labelText: string;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

const GraphTrafficComponent: React.FC<GraphTrafficProps> = (props: GraphTrafficProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const onToggle = (isOpen: boolean) => {
    setIsOpen(isOpen);
  };

  const getPopoverContent = () => {
    const trafficRates = props.trafficRates;

    const trafficRateOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.AMBIENT_GROUP,
        labelText: _.startCase(TrafficRate.AMBIENT_GROUP),
        isChecked: trafficRates.includes(TrafficRate.AMBIENT_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Displays active Edges for the time period, as reported by the enabled Istio Ambient components. This is
            independent of specific protocols. Default: All.
          </div>
        )
      },
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

    const ambientOptions: TrafficRateOptionType[] = [
      {
        id: TrafficRate.AMBIENT_WAYPOINT,
        labelText: 'Waypoint',
        isChecked: trafficRates.includes(TrafficRate.AMBIENT_WAYPOINT),
        tooltip: (
          <div style={{ textAlign: 'left' }}>Limit to only waypoint reported traffic, for the enabled protocols.</div>
        )
      },
      {
        id: TrafficRate.AMBIENT_ZTUNNEL,
        labelText: 'ZTunnel',
        isChecked: trafficRates.includes(TrafficRate.AMBIENT_ZTUNNEL),
        tooltip: (
          <div style={{ textAlign: 'left' }}>Limit to only ztunnel reported traffic, for the enabled protocols.</div>
        )
      },
      {
        id: TrafficRate.AMBIENT_TOTAL,
        labelText: 'Total',
        isChecked: trafficRates.includes(TrafficRate.AMBIENT_TOTAL),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Total traffic reported by Ambient components, for the enabled protocols.
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
                  isDisabled={props.disabled}
                  label={trafficRateOption.labelText}
                  onChange={(event, _) => toggleTrafficRate(_, event)}
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

              {trafficRateOption.id === TrafficRate.AMBIENT_GROUP && ambientOptions.some(o => o.isChecked) && (
                <div>
                  {ambientOptions.map((ambientOption: TrafficRateOptionType) => (
                    <div key={ambientOption.id} className={menuEntryStyle}>
                      <label
                        key={ambientOption.id}
                        className={!!ambientOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={ambientOption.id}
                          style={{ paddingLeft: '0.25rem' }}
                          name="ambientOptions"
                          isChecked={ambientOption.isChecked}
                          isDisabled={props.disabled}
                          label={ambientOption.labelText}
                          onChange={(event, _) => toggleTrafficRateAmbient(_, event)}
                          value={ambientOption.id}
                        />
                      </label>
                      {!!ambientOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${ambientOption.id}`}
                          position={TooltipPosition.right}
                          content={ambientOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {trafficRateOption.id === TrafficRate.GRPC_GROUP && grpcOptions.some(o => o.isChecked) && (
                <div>
                  {grpcOptions.map((grpcOption: TrafficRateOptionType) => (
                    <div key={grpcOption.id} className={menuEntryStyle}>
                      <label
                        key={grpcOption.id}
                        className={!!grpcOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={grpcOption.id}
                          style={{ paddingLeft: '0.25rem' }}
                          name="grpcOptions"
                          isChecked={grpcOption.isChecked}
                          isDisabled={props.disabled}
                          label={grpcOption.labelText}
                          onChange={(event, _) => toggleTrafficRateGrpc(_, event)}
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
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={httpOption.id}
                          style={{ paddingLeft: '0.25rem' }}
                          name="httpOptions"
                          isChecked={httpOption.isChecked}
                          isDisabled={props.disabled}
                          label={httpOption.labelText}
                          onChange={(event, _) => toggleTrafficRateHttp(_, event)}
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
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={tcpOption.id}
                          style={{ paddingLeft: '0.25rem' }}
                          name="tcpOptions"
                          isChecked={tcpOption.isChecked}
                          isDisabled={props.disabled}
                          label={tcpOption.labelText}
                          onChange={(event, _) => toggleTrafficRateTcp(_, event)}
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
  };

  const toggleTrafficRate = (_, event) => {
    const rate = event.target.value as TrafficRate;

    if (props.trafficRates.includes(rate)) {
      let newRates: TrafficRate[];

      switch (rate) {
        case TrafficRate.AMBIENT_GROUP:
          newRates = props.trafficRates.filter(r => !isAmbientRate(r));
          break;
        case TrafficRate.GRPC_GROUP:
          newRates = props.trafficRates.filter(r => !isGrpcRate(r));
          break;
        case TrafficRate.HTTP_GROUP:
          newRates = props.trafficRates.filter(r => !isHttpRate(r));
          break;
        case TrafficRate.TCP_GROUP:
          newRates = props.trafficRates.filter(r => !isTcpRate(r));
          break;
        default:
          newRates = props.trafficRates.filter(r => r !== rate);
      }

      props.setTrafficRates(newRates);
    } else {
      switch (rate) {
        case TrafficRate.AMBIENT_GROUP:
          props.setTrafficRates([...props.trafficRates, rate, TrafficRate.AMBIENT_TOTAL]);
          break;
        case TrafficRate.GRPC_GROUP:
          props.setTrafficRates([...props.trafficRates, rate, TrafficRate.GRPC_REQUEST]);
          break;
        case TrafficRate.HTTP_GROUP:
          props.setTrafficRates([...props.trafficRates, rate, TrafficRate.HTTP_REQUEST]);
          break;
        case TrafficRate.TCP_GROUP:
          props.setTrafficRates([...props.trafficRates, rate, TrafficRate.TCP_SENT]);
          break;
        default:
          props.setTrafficRates([...props.trafficRates, rate]);
      }
    }
  };

  const toggleTrafficRateAmbient = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = props.trafficRates.filter(r => !isAmbientRate(r));
    props.setTrafficRates([...newRates, TrafficRate.AMBIENT_GROUP, rate]);
  };

  const toggleTrafficRateGrpc = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = props.trafficRates.filter(r => !isGrpcRate(r));
    props.setTrafficRates([...newRates, TrafficRate.GRPC_GROUP, rate]);
  };

  const toggleTrafficRateHttp = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = props.trafficRates.filter(r => !isHttpRate(r));
    props.setTrafficRates([...newRates, TrafficRate.HTTP_GROUP, rate]);
  };

  const toggleTrafficRateTcp = (_, event) => {
    const rate = event.target.value as TrafficRate;
    const newRates = props.trafficRates.filter(r => !isTcpRate(r));
    props.setTrafficRates([...newRates, TrafficRate.TCP_GROUP, rate]);
  };

  return (
    <Dropdown
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          id="graph-traffic-dropdown"
          isDisabled={props.disabled}
          onClick={() => onToggle(!isOpen)}
          isExpanded={isOpen}
        >
          Traffic
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
    >
      <DropdownList>{getPopoverContent()}</DropdownList>
    </Dropdown>
  );
};

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  trafficRates: trafficRatesSelector(state)
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setTrafficRates: bindActionCreators(GraphToolbarActions.setTrafficRates, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
export const GraphTraffic = connect(mapStateToProps, mapDispatchToProps)(GraphTrafficComponent);
