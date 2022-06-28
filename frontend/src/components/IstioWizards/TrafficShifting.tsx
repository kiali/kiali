import * as React from 'react';
import { cellWidth, ICell, Table, TableHeader, TableBody } from '@patternfly/react-table';
import Slider from './Slider/Slider';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';
import { PFColors } from '../Pf/PfColors';
import { Button, ButtonVariant, TooltipPosition } from '@patternfly/react-core';
import { EqualizerIcon } from '@patternfly/react-icons';
import { getDefaultWeights } from './WizardActions';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type Props = {
  workloads: WorkloadOverview[];
  initWeights: WorkloadWeight[];
  onChange: (valid: boolean, workloads: WorkloadWeight[], reset: boolean) => void;
  showValid: boolean;
  showMirror: boolean;
};

export type WorkloadWeight = {
  name: string;
  weight: number;
  locked: boolean;
  maxWeight: number;
  mirrored: boolean;
};

type State = {
  workloads: WorkloadWeight[];
};

const validationStyle = style({
  marginBottom: 10,
  color: PFColors.Red100,
  textAlign: 'right'
});

const evenlyButtonStyle = style({
  width: '100%',
  textAlign: 'right'
});

export const MSG_WEIGHTS_NOT_VALID = 'The sum of all non-mirrored weights must be 100 %';

class TrafficShifting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      workloads: []
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
          workloads:
            prevState.workloads.length === 0 && this.props.initWeights.length > 0
              ? this.props.initWeights
              : getDefaultWeights(this.props.workloads)
        };
      },
      () => this.props.onChange(this.checkTotalWeight(), this.state.workloads, true)
    );
  };

  onWeight = (workloadName: string, newWeight: number) => {
    this.setState(
      prevState => {
        const nodeId: number[] = [];
        let maxWeight = 100;

        // Calculate maxWeight from locked nodes
        for (let i = 0; i < prevState.workloads.length; i++) {
          if (prevState.workloads[i].locked) {
            maxWeight -= prevState.workloads[i].weight;
          }
        }

        // Set new weight; remember rest of the nodes
        for (let i = 0; i < prevState.workloads.length; i++) {
          if (prevState.workloads[i].name === workloadName) {
            prevState.workloads[i].weight = newWeight;
            // Don't update maxWeight if node is mirrored
            if (!prevState.workloads[i].mirrored) {
              maxWeight -= newWeight;
            }
          } else if (!prevState.workloads[i].locked && !prevState.workloads[i].mirrored) {
            // Only adjust those nodes that are not locked
            nodeId.push(i);
          }
        }

        // Distribute pending weights
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + prevState.workloads[nodeId[j]].weight > maxWeight) {
            prevState.workloads[nodeId[j]].weight = maxWeight - sumWeights;
          }
          sumWeights += prevState.workloads[nodeId[j]].weight;
        }

        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeight) {
          prevState.workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
        }

        return {
          workloads: prevState.workloads
        };
      },
      () => this.props.onChange(this.checkTotalWeight(), this.state.workloads, false)
    );
  };

  onLock = (workloadName: string, locked: boolean) => {
    this.setState(prevState => {
      let maxWeights = 100;
      for (let i = 0; i < prevState.workloads.length; i++) {
        if (prevState.workloads[i].name === workloadName) {
          prevState.workloads[i].locked = locked;
        }
        // Calculate maxWeights from locked nodes
        if (prevState.workloads[i].locked) {
          maxWeights -= prevState.workloads[i].weight;
        }
      }
      // Update non locked nodes maxWeight
      for (let i = 0; i < prevState.workloads.length; i++) {
        if (!prevState.workloads[i].locked && !prevState.workloads[i].mirrored) {
          prevState.workloads[i].maxWeight = maxWeights;
        }
      }
      return {
        workloads: prevState.workloads
      };
    });
  };

  onMirror = (workloadName: string, mirrored: boolean) => {
    this.setState(
      prevState => {
        const nodeId: number[] = [];
        let maxWeight = 100;

        // Reset all mirrored workload but selected one.
        for (let i = 0; i < prevState.workloads.length; i++) {
          prevState.workloads[i].mirrored = false;
          prevState.workloads[i].locked = false;
          if (mirrored && prevState.workloads[i].name === workloadName) {
            prevState.workloads[i].mirrored = mirrored;
            prevState.workloads[i].locked = false;
          }
          if (!prevState.workloads[i].mirrored) {
            nodeId.push(i);
          }
        }

        // Distribute pending weights
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + prevState.workloads[nodeId[j]].weight > maxWeight) {
            prevState.workloads[nodeId[j]].weight = maxWeight - sumWeights;
          }
          sumWeights += prevState.workloads[nodeId[j]].weight;
        }

        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeight) {
          prevState.workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
        }

        return {
          workloads: prevState.workloads
        };
      },
      () => this.props.onChange(this.checkTotalWeight(), this.state.workloads, false)
    );
  };

  checkTotalWeight = (): boolean => {
    // Check all weights are equal to 100
    return (
      this.state.workloads
        .filter(w => !w.mirrored)
        .map(w => w.weight)
        .reduce((a, b) => a + b, 0) === 100
    );
  };

  render() {
    const isValid = this.checkTotalWeight();
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    const workloadCells: ICell[] = [
      {
        title: 'Destination Workload',
        transforms: [cellWidth(30) as any],
        props: {}
      },
      {
        title: 'Traffic Weight',
        transforms: [cellWidth(70) as any],
        props: {}
      }
    ];
    const workloadsRows = this.state.workloads
      .filter(workload => !workload.mirrored)
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
                max={workload.maxWeight}
                maxLimit={100}
                onSlide={value => {
                  this.onWeight(workload.name, value as number);
                }}
                onSlideStop={value => {
                  this.onWeight(workload.name, value as number);
                }}
                locked={this.state.workloads.length > 1 ? workload.locked : true}
                showLock={this.state.workloads.length > 2}
                onLock={locked => this.onLock(workload.name, locked)}
                mirrored={workload.mirrored}
                showMirror={this.props.showMirror && this.state.workloads.length > 1}
                onMirror={mirrored => this.onMirror(workload.name, mirrored)}
              />
            </>
          ]
        };
      });
    const mirrorCells: ICell[] = [
      {
        title: 'Mirrored Workload',
        transforms: [cellWidth(30) as any],
        props: {}
      },
      {
        title: 'Mirror Percentage',
        transforms: [cellWidth(70) as any],
        props: {}
      }
    ];
    const mirrorRows = this.state.workloads
      .filter(workload => workload.mirrored)
      .map(workload => {
        return {
          cells: [
            <>
              <div>
                <PFBadge badge={PFBadges.MirroredWorkload} position={TooltipPosition.top} />
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
                max={workload.maxWeight}
                maxLimit={100}
                onSlide={value => {
                  this.onWeight(workload.name, value as number);
                }}
                onSlideStop={value => {
                  this.onWeight(workload.name, value as number);
                }}
                locked={this.state.workloads.length > 1 ? workload.locked : true}
                showLock={this.state.workloads.length > 2}
                onLock={locked => this.onLock(workload.name, locked)}
                mirrored={workload.mirrored}
                showMirror={this.props.showMirror}
                onMirror={mirrored => this.onMirror(workload.name, mirrored)}
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
        {mirrorRows.length > 0 && (
          <Table cells={mirrorCells} rows={mirrorRows} aria-label="mirrors">
            <TableHeader />
            <TableBody />
          </Table>
        )}
        {this.props.workloads.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button variant={ButtonVariant.link} icon={<EqualizerIcon />} onClick={() => this.resetState()}>
              Evenly distribute traffic
            </Button>{' '}
          </div>
        )}
        {this.props.showValid && !isValid && <div className={validationStyle}>{MSG_WEIGHTS_NOT_VALID}</div>}
      </>
    );
  }
}

export default TrafficShifting;
