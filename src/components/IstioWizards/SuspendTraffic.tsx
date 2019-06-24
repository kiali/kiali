import * as React from 'react';
import { Button, Col, Icon, ListView, ListViewIcon, ListViewItem, Row } from 'patternfly-react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';

type Props = {
  serviceName: string;
  workloads: WorkloadOverview[];
  initSuspendedRoutes: SuspendedRoute[];
  onChange: (valid: boolean, suspendedRoutes: SuspendedRoute[]) => void;
};

export type SuspendedRoute = {
  workload: string;
  suspended: boolean;
  httpStatus: number;
};

type State = {
  suspendedRoutes: SuspendedRoute[];
};

const wkIconType = 'pf';
const wkIconName = 'bundle';

const SERVICE_UNAVAILABLE = 503;

const listStyle = style({
  marginTop: 10
});

const listHeaderStyle = style({
  textTransform: 'uppercase',
  fontSize: '12px',
  fontWeight: 300,
  color: '#72767b',
  borderTop: '0px !important',
  $nest: {
    '.list-view-pf-main-info': {
      padding: 5
    },
    '.list-group-item-heading': {
      fontWeight: 300,
      textAlign: 'center'
    },
    '.list-group-item-text': {
      textAlign: 'center'
    }
  }
});

const evenlyButtonStyle = style({
  width: '100%',
  textAlign: 'right'
});

const allButtonStyle = style({
  marginBottom: 20,
  marginLeft: 5
});

class SuspendTraffic extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      suspendedRoutes: []
    };
  }

  componentDidMount(): void {
    this.resetState();
  }

  resetState = () => {
    const defaultSuspendedRoutes = this.props.workloads.map(workload => {
      return {
        workload: workload.name,
        suspended: false,
        httpStatus: SERVICE_UNAVAILABLE
      };
    });
    this.setState(
      prevState => {
        return {
          suspendedRoutes:
            prevState.suspendedRoutes.length === 0 && this.props.initSuspendedRoutes.length > 0
              ? this.props.initSuspendedRoutes
              : defaultSuspendedRoutes
        };
      },
      () => this.props.onChange(true, this.state.suspendedRoutes)
    );
  };

  suspendAll = () => {
    this.setState(
      {
        suspendedRoutes: this.props.workloads.map(workload => {
          return {
            workload: workload.name,
            suspended: true,
            httpStatus: SERVICE_UNAVAILABLE
          };
        })
      },
      () => this.props.onChange(true, this.state.suspendedRoutes)
    );
  };

  updateRoute = (workload: string, suspended: boolean) => {
    this.setState(
      prevState => {
        return {
          suspendedRoutes: prevState.suspendedRoutes.map(route => {
            if (route.workload === workload) {
              return {
                workload: route.workload,
                suspended: suspended,
                // Note that in a future version we might want to let user to choose the httpStatus
                httpStatus: SERVICE_UNAVAILABLE
              };
            }
            return route;
          })
        };
      },
      () => this.props.onChange(true, this.state.suspendedRoutes)
    );
  };

  render() {
    return (
      <>
        <ListView className={listStyle}>
          <ListViewItem className={listHeaderStyle} heading={'Workload'} description={'Suspended Status'} />
          {this.state.suspendedRoutes.map((route, id) => {
            return (
              <ListViewItem
                key={'workload-' + id}
                leftContent={<ListViewIcon type={wkIconType} name={wkIconName} />}
                heading={route.workload}
                description={
                  <Row>
                    <Col xs={12} sm={12} md={4} lg={4} />
                    <Col xs={12} sm={12} md={2} lg={2}>
                      {route.suspended ? 'Suspended' : 'Connected'}
                    </Col>
                    <Col xs={12} sm={12} md={2} lg={2}>
                      <Button bsSize="xsmall" onClick={() => this.updateRoute(route.workload, !route.suspended)}>
                        <Icon type="pf" name={route.suspended ? 'unplugged' : 'plugged'} />
                      </Button>
                    </Col>
                    <Col xs={12} sm={12} md={4} lg={4} />
                  </Row>
                }
              />
            );
          })}
        </ListView>
        {this.props.workloads.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button className={allButtonStyle} onClick={() => this.resetState()}>
              Connect All
            </Button>
            <Button className={allButtonStyle} onClick={() => this.suspendAll()}>
              Suspend All
            </Button>
          </div>
        )}
      </>
    );
  }
}

export default SuspendTraffic;
