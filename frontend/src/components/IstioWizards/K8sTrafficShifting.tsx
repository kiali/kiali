import * as React from 'react';
import { cellWidth, ICell, Table, TableHeader, TableBody } from '@patternfly/react-table';
import Slider from './Slider/Slider';
import { style } from 'typestyle';
import { Button, ButtonVariant, TooltipPosition } from '@patternfly/react-core';
import { EqualizerIcon } from '@patternfly/react-icons';
import {getDefaultBackendRefs} from './WizardActions';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import {ServiceOverview} from "../../types/ServiceList";

type Props = {
  subServices: ServiceOverview[];
  initRefs: K8sRouteBackendRef[];
  onChange: (backendRefs: K8sRouteBackendRef[], reset: boolean) => void;
  showValid: boolean;
};

export type K8sRouteBackendRef = {
  name: string;
  weight: number;
  port?: number;
};

export type K8sRouteFilter = {
  type: string;
  requestHeaderModifier?: K8sHeaderFilter;
};

export type K8sHeaderFilter = {
  set?: K8sHeader[];
  add?: K8sHeader[];
  remove?: string[];
};

export type K8sHeader = {
  name: string;
  value: string;
};

type State = {
  backendRefs: K8sRouteBackendRef[];
};

const evenlyButtonStyle = style({
  width: '100%',
  textAlign: 'right'
});

class K8sTrafficShifting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      backendRefs: []
    };
  }

  componentDidMount() {
    this.resetState();
  }

  resetState = () => {
    if (this.props.subServices.length === 0) {
      return;
    }
    this.setState(
      prevState => {
        return {
          backendRefs:
            prevState.backendRefs.length === 0 && this.props.initRefs.length > 0
              ? this.props.initRefs
              : getDefaultBackendRefs(this.props.subServices)
        };
      },
      () => this.props.onChange(this.state.backendRefs, true)
    );
  };

  onWeight = (serviceName: string, newWeight: number) => {
    this.setState(
      prevState => {
         // Set new weight; remember rest of the nodes
        for (let i = 0; i < prevState.backendRefs.length; i++) {
          if (prevState.backendRefs[i].name === serviceName) {
            prevState.backendRefs[i].weight = newWeight;
          }
        }

        return {
          backendRefs: prevState.backendRefs
        };
      },
      () => this.props.onChange(this.state.backendRefs, false)
    );
  };

  render() {
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    const serviceCells: ICell[] = [
      {
        title: 'Destination Service',
        transforms: [cellWidth(30) as any],
        props: {}
      },
      {
        title: 'Traffic Weight',
        transforms: [cellWidth(70) as any],
        props: {}
      }
    ];
    const servicesRows = this.state.backendRefs
      .map(service => {
        return {
          cells: [
            <>
              <div>
                <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                {service.name}
              </div>
            </>,
            // This <> wrapper is needed by Slider
            <>
              <Slider
                id={'slider-' + service.name}
                key={'slider-' + service.name}
                tooltip={true}
                input={true}
                inputFormat=""
                value={service.weight}
                min={0}
                max={100}
                maxLimit={100}
                onSlide={value => {
                  this.onWeight(service.name, value as number);
                }}
                onSlideStop={value => {
                  this.onWeight(service.name, value as number);
                }}
                locked={false}
                showLock={false}
                mirrored={false}
              />
            </>
          ]
        };
      });
    return (
      <>
        <Table cells={serviceCells} rows={servicesRows} aria-label="weighted routing">
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.subServices.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button variant={ButtonVariant.link} icon={<EqualizerIcon />} onClick={() => this.resetState()}>
              Evenly distribute traffic
            </Button>{' '}
          </div>
        )}
      </>
    );
  }
}

export default K8sTrafficShifting;
