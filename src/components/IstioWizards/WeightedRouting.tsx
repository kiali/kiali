import * as React from 'react';
import { cellWidth, ICell, Table, TableHeader, TableBody } from '@patternfly/react-table';
import Slider from './Slider/Slider';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { style } from 'typestyle';
import { PfColors } from '../Pf/PfColors';
import { Badge, Button, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { EqualizerIcon } from '@patternfly/react-icons';

type Props = {
  serviceName: string;
  workloads: WorkloadOverview[];
  initWeights: WorkloadWeight[];
  onChange: (valid: boolean, workloads: WorkloadWeight[], reset: boolean) => void;
};

export type WorkloadWeight = {
  name: string;
  weight: number;
  locked: boolean;
  maxWeight: number;
};

type State = {
  workloads: WorkloadWeight[];
};

const validationStyle = style({
  marginBottom: 10,
  color: PfColors.Red100,
  textAlign: 'right'
});

const evenlyButtonStyle = style({
  width: '100%',
  textAlign: 'right'
});

class WeightedRouting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      workloads: []
    };
  }

  componentDidMount() {
    this.resetState();
  }

  getDefaultWeights = (workloads: WorkloadOverview[]): WorkloadWeight[] => {
    const wkTraffic = workloads.length < 100 ? Math.round(100 / workloads.length) : 0;
    const remainTraffic = workloads.length < 100 ? 100 % workloads.length : 0;
    const wkWeights: WorkloadWeight[] = workloads.map(workload => ({
      name: workload.name,
      weight: wkTraffic,
      locked: false,
      maxWeight: 100
    }));
    if (remainTraffic > 0) {
      wkWeights[wkWeights.length - 1].weight = wkWeights[wkWeights.length - 1].weight + remainTraffic;
    }
    return wkWeights;
  };

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
              : this.getDefaultWeights(this.props.workloads)
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
            maxWeight -= newWeight;
          } else if (!prevState.workloads[i].locked) {
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
        if (!prevState.workloads[i].locked) {
          prevState.workloads[i].maxWeight = maxWeights;
        }
      }
      return {
        workloads: prevState.workloads
      };
    });
  };

  checkTotalWeight = (): boolean => {
    // Check all weights are equal to 100
    return this.state.workloads.map(w => w.weight).reduce((a, b) => a + b, 0) === 100;
  };

  render() {
    const isValid = this.checkTotalWeight();
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    const headerCells: ICell[] = [
      {
        title: 'Workload',
        transforms: [cellWidth(30) as any],
        props: {}
      },
      {
        title: 'Traffic Weight',
        transforms: [cellWidth(70) as any],
        props: {}
      }
    ];
    const workloadsRows = this.state.workloads.map(workload => {
      return {
        cells: [
          <>
            <Tooltip key={'tooltip_' + workload.name} position={TooltipPosition.top} content={<>Workload</>}>
              <Badge className={'virtualitem_badge_definition'}>WS</Badge>
            </Tooltip>
            {workload.name}
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
              locked={this.state.workloads.length > 1 ? workload.locked : true}
              showLock={this.state.workloads.length > 2}
              onLock={locked => this.onLock(workload.name, locked)}
            />
          </>
        ]
      };
    });
    return (
      <>
        <Table cells={headerCells} rows={workloadsRows} aria-label="weighted routing">
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.workloads.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button variant="link" icon={<EqualizerIcon />} onClick={() => this.resetState()}>
              Evenly distribute traffic
            </Button>{' '}
          </div>
        )}
        {!isValid && <div className={validationStyle}>The sum of all weights must be 100 %</div>}
      </>
    );
  }
}

export default WeightedRouting;
