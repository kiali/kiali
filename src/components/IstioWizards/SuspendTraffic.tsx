import * as React from 'react';
import { Table, TableHeader, TableBody } from '@patternfly/react-table';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';
import { Badge, Button, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { PluggedIcon, UnpluggedIcon } from '@patternfly/react-icons';

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

const SERVICE_UNAVAILABLE = 503;

const evenlyButtonStyle = style({
  width: '100%',
  textAlign: 'right'
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
    const headerCells = [
      {
        title: 'Workload',
        props: {}
      },
      {
        title: 'Suspended Status',
        props: {}
      }
    ];
    const workloadsRows = this.state.suspendedRoutes.map(route => {
      return {
        cells: [
          <>
            <Tooltip position={TooltipPosition.top} content={<>Workload</>}>
              <Badge className={'virtualitem_badge_definition'}>WS</Badge>
            </Tooltip>
            {route.workload}
          </>,
          // Note that <Button> here needs to be wrapped by an external <>, otherwise Icon is not properly rendered.
          <>
            <Button
              variant="link"
              icon={route.suspended ? <UnpluggedIcon /> : <PluggedIcon />}
              onClick={() => this.updateRoute(route.workload, !route.suspended)}
            >
              {route.suspended ? 'Suspended' : 'Connected'}
            </Button>
          </>
        ]
      };
    });
    return (
      <>
        <Table cells={headerCells} rows={workloadsRows}>
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.workloads.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button variant="link" icon={<PluggedIcon />} onClick={() => this.resetState()}>
              Connect All
            </Button>{' '}
            <Button variant="link" icon={<UnpluggedIcon />} onClick={() => this.suspendAll()}>
              Suspend All
            </Button>
          </div>
        )}
      </>
    );
  }
}

export default SuspendTraffic;
