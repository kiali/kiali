import * as React from 'react';
import { cellWidth, ICell, Table, TableHeader, TableBody } from '@patternfly/react-table';
import Slider from './Slider/Slider';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';
import { Button, ButtonVariant, TooltipPosition } from '@patternfly/react-core';
import { EqualizerIcon } from '@patternfly/react-icons';
import {getDefaultBackendRefs} from './WizardActions';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type Props = {
  workloads: WorkloadOverview[];
  initRefs: K8sRouteBackendRef[];
  onChange: (backendRefs: K8sRouteBackendRef[], reset: boolean) => void;
  showValid: boolean;
  showMirror: boolean;
};

export type K8sRouteBackendRef = {
  name: string;
  weight: number;
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
    if (this.props.workloads.length === 0) {
      return;
    }
    this.setState(
      prevState => {
        return {
          backendRefs:
            prevState.backendRefs.length === 0 && this.props.initRefs.length > 0
              ? this.props.initRefs
              : getDefaultBackendRefs(this.props.workloads)
        };
      },
      () => this.props.onChange(this.state.backendRefs, true)
    );
  };

  onWeight = (workloadName: string, newWeight: number) => {
    this.setState(
      prevState => {
        const nodeId: number[] = [];
        let maxWeight = 100;

        // Set new weight; remember rest of the nodes
        for (let i = 0; i < prevState.backendRefs.length; i++) {
          if (prevState.backendRefs[i].name === workloadName) {
            prevState.backendRefs[i].weight = newWeight;
            maxWeight -= newWeight;
          }
        }

        // Distribute pending weights
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + prevState.backendRefs[nodeId[j]].weight > maxWeight) {
            prevState.backendRefs[nodeId[j]].weight = maxWeight - sumWeights;
          }
          sumWeights += prevState.backendRefs[nodeId[j]].weight;
        }

        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeight) {
          prevState.backendRefs[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
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
    const workloadCells: ICell[] = [
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
    const workloadsRows = this.state.backendRefs
      .map(workload => {
        return {
          cells: [
            <>
              <div>
                <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                {workload.name}
              </div>
            </>,
            // This <> wrapper is needed by Slider
            <>
              <Slider
                id={'slider-' + workload.name}
                key={'slider-' + workload.name}
                tooltip={true}
                input={true}
                inputFormat="%"
                value={workload.weight}
                min={0}
                max={100}
                maxLimit={100}
                onSlide={value => {
                  this.onWeight(workload.name, value as number);
                }}
                onSlideStop={value => {
                  this.onWeight(workload.name, value as number);
                }}
                locked={false}
                showLock={false}
                showMirror={false}
                mirrored={false}
              />
            </>
          ]
        };
      });
    return (
      <>
        <Table cells={workloadCells} rows={workloadsRows} aria-label="weighted routing">
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.workloads.length > 1 && (
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
