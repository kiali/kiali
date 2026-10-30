import * as React from 'react';
import { RoutingSlider } from 'components/Slider';
import type { WorkloadOverview } from '../../types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../Pf/PfColors';
import {
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  ExpandableSection,
  TooltipPosition
} from '@patternfly/react-core';
import { getDefaultWeights } from './WizardActions';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import type { SortableTh } from 'components/Table/SimpleTable';
import { SimpleTable } from 'components/Table/SimpleTable';
import { t } from 'utils/I18nUtils';
import { BalanceScaleIcon, MigrationIcon } from '@patternfly/react-icons';

type Props = {
  initWeights: WorkloadWeight[];
  onChange: (valid: boolean, workloads: WorkloadWeight[], reset: boolean) => void;
  showMirror: boolean;
  showValid: boolean;
  workloads: WorkloadOverview[];
};

export type WorkloadWeight = {
  locked: boolean;
  maxWeight: number;
  mirrored: boolean;
  name: string;
  weight: number;
};

type State = {
  mirroringSectionExpanded: boolean;
  workloads: WorkloadWeight[];
};

const evenlyButtonStyle = kialiStyle({
  // Push the button to the right
  marginLeft: 'auto',
  // Remove the default button padding so that
  // the button is aligned with the text to the left.
  paddingBottom: '0'
});

const evenlyCellStyle = kialiStyle({
  display: 'flex',
  // Align the text to the bottom
  alignItems: 'flex-end'
});

const mirroringSectionStyle = kialiStyle({
  marginTop: '1rem'
});

const emptyStateStyle = kialiStyle({
  padding: '1rem'
});

const validationStyle = kialiStyle({
  marginBottom: '0.5rem',
  color: PFColors.Red500,
  textAlign: 'right'
});

export const MSG_WEIGHTS_NOT_VALID = t('The sum of all non-mirrored weights must be 100 %');

export const rebalanceUnlockedWeights = (workloads: WorkloadWeight[]): void => {
  let maxWeight = 100;
  const nodeId: number[] = [];

  for (let i = 0; i < workloads.length; i++) {
    if (workloads[i].locked && !workloads[i].mirrored) {
      maxWeight -= workloads[i].weight;
    }
  }
  maxWeight = Math.max(0, maxWeight);

  for (let i = 0; i < workloads.length; i++) {
    if (!workloads[i].locked && !workloads[i].mirrored) {
      nodeId.push(i);
    }
  }

  let sumWeights = 0;
  for (let j = 0; j < nodeId.length; j++) {
    if (sumWeights + workloads[nodeId[j]].weight > maxWeight) {
      workloads[nodeId[j]].weight = Math.max(0, maxWeight - sumWeights);
    }
    sumWeights += workloads[nodeId[j]].weight;
  }

  if (nodeId.length > 0 && sumWeights < maxWeight) {
    workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
  }
};

export const sumNonMirroredWeights = (workloads: WorkloadWeight[]): number =>
  workloads.filter(w => !w.mirrored).reduce((sum, w) => sum + w.weight, 0);

export class TrafficShifting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      mirroringSectionExpanded: false,
      workloads: []
    };
  }

  componentDidMount(): void {
    this.resetState();
  }

  resetState = (): void => {
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

  onWeight = (workloadName: string, newWeight: number): void => {
    this.setState(
      prevState => {
        const workloads = prevState.workloads.map(w => ({ ...w }));
        const nodeId: number[] = [];
        let maxWeight = 100;

        // Calculate maxWeight from locked nodes (mirrored weights are outside the 100 % pool)
        for (let i = 0; i < workloads.length; i++) {
          if (workloads[i].locked && !workloads[i].mirrored) {
            maxWeight -= workloads[i].weight;
          }
        }
        maxWeight = Math.max(0, maxWeight);

        const changedIndex = workloads.findIndex(w => w.name === workloadName);
        if (changedIndex >= 0) {
          const nodeMax = workloads[changedIndex].maxWeight;
          newWeight = Math.max(0, Math.min(nodeMax, newWeight));
        }

        // Set new weight; remember rest of the nodes
        for (let i = 0; i < workloads.length; i++) {
          if (workloads[i].name === workloadName) {
            workloads[i].weight = newWeight;
            // Don't update maxWeight if node is mirrored
            if (!workloads[i].mirrored) {
              maxWeight -= newWeight;
            }
          } else if (!workloads[i].locked && !workloads[i].mirrored) {
            // Only adjust those nodes that are not locked
            nodeId.push(i);
          }
        }

        maxWeight = Math.max(0, maxWeight);

        // Distribute pending weights
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + workloads[nodeId[j]].weight > maxWeight) {
            workloads[nodeId[j]].weight = Math.max(0, maxWeight - sumWeights);
          }
          sumWeights += workloads[nodeId[j]].weight;
        }

        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeight) {
          workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
        }

        return {
          workloads
        };
      },
      () => this.props.onChange(this.checkTotalWeight(), this.state.workloads, false)
    );
  };

  onLock = (workloadName: string, locked: boolean): void => {
    this.setState(
      prevState => {
        const workloads = prevState.workloads.map(w => ({ ...w }));

        for (let i = 0; i < workloads.length; i++) {
          if (workloads[i].name === workloadName) {
            workloads[i].locked = locked;
          }
        }

        let maxWeights = 100;
        for (let i = 0; i < workloads.length; i++) {
          if (workloads[i].locked && !workloads[i].mirrored) {
            maxWeights -= workloads[i].weight;
          }
        }
        maxWeights = Math.max(0, maxWeights);

        // Update non locked nodes maxWeight and clamp weights that exceed the new cap
        for (let i = 0; i < workloads.length; i++) {
          if (!workloads[i].locked && !workloads[i].mirrored) {
            workloads[i].maxWeight = maxWeights;
            if (workloads[i].weight > maxWeights) {
              workloads[i].weight = maxWeights;
            }
          }
        }

        if (locked) {
          rebalanceUnlockedWeights(workloads);
        }

        // When unlocking, assign remaining traffic so non-mirrored weights still sum to 100 %
        if (!locked) {
          let lockedSum = 0;
          let unlockedSum = 0;
          for (let i = 0; i < workloads.length; i++) {
            if (workloads[i].mirrored) {
              continue;
            }
            if (workloads[i].locked) {
              lockedSum += workloads[i].weight;
            } else {
              unlockedSum += workloads[i].weight;
            }
          }
          const deficit = 100 - lockedSum - unlockedSum;
          if (deficit > 0) {
            const unlockedIndex = workloads.findIndex(w => w.name === workloadName);
            if (unlockedIndex >= 0 && !workloads[unlockedIndex].mirrored && !workloads[unlockedIndex].locked) {
              workloads[unlockedIndex].weight = Math.min(
                workloads[unlockedIndex].maxWeight,
                workloads[unlockedIndex].weight + deficit
              );
            }
          }
          rebalanceUnlockedWeights(workloads);
        }

        return {
          workloads
        };
      },
      () => this.props.onChange(this.checkTotalWeight(), this.state.workloads, false)
    );
  };

  onMirror = (workloadName: string, mirrored: boolean): void => {
    this.setState(
      prevState => {
        const workloads = prevState.workloads.map(w => ({ ...w }));
        const nodeId: number[] = [];
        const maxWeight = 100;

        // Reset all mirrored workload but selected one.
        for (let i = 0; i < workloads.length; i++) {
          workloads[i].mirrored = false;
          workloads[i].locked = false;
          if (mirrored && workloads[i].name === workloadName) {
            workloads[i].mirrored = mirrored;
            workloads[i].locked = false;
          }
          if (!workloads[i].mirrored) {
            nodeId.push(i);
          }
        }

        // Distribute pending weights
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + workloads[nodeId[j]].weight > maxWeight) {
            workloads[nodeId[j]].weight = Math.max(0, maxWeight - sumWeights);
          }
          sumWeights += workloads[nodeId[j]].weight;
        }

        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeight) {
          workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
        }

        for (let i = 0; i < workloads.length; i++) {
          if (!workloads[i].locked && !workloads[i].mirrored) {
            workloads[i].maxWeight = 100;
          }
        }

        return {
          // Auto-expand section when mirroring is enabled
          mirroringSectionExpanded: mirrored ? true : prevState.mirroringSectionExpanded,
          workloads
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

  render(): React.ReactNode {
    const isValid = this.checkTotalWeight();

    const workloadColumns: SortableTh[] = [
      {
        title: t('Destination workload'),
        width: 30,
        sortable: false
      },
      {
        sortable: false,
        title: t('Traffic weight'),
        width: 70,
        headerContent: (
          <div className={evenlyCellStyle}>
            {t('Traffic weight')}
            {this.props.workloads.length > 1 ? (
              <Button
                className={evenlyButtonStyle}
                variant={ButtonVariant.link}
                icon={<BalanceScaleIcon className={kialiStyle({ color: PFColors.Link })} />}
                onClick={() => this.resetState()}
                aria-label={t('Evenly distribute traffic')}
              >
                {t('Evenly distribute')}
              </Button>
            ) : undefined}
          </div>
        )
      }
    ];

    const workloadRows = this.state.workloads
      .filter(workload => !workload.mirrored)
      .map(workload => {
        return {
          cells: [
            <div>
              <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
              {workload.name}
            </div>,

            <RoutingSlider
              id={`slider-${workload.name}`}
              key={`slider-${workload.name}`}
              tooltip={true}
              input={true}
              inputFormat="%"
              value={workload.weight}
              min={0}
              max={workload.maxWeight}
              maxRailWidth="195px"
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
          ]
        };
      });

    const mirroredWorkload = this.state.workloads.find(w => w.mirrored);

    // Build the section title with workload info when collapsed
    const mirroringSectionTitle = mirroredWorkload
      ? `${t('Mirroring traffic')} (${mirroredWorkload.name}; ${mirroredWorkload.weight}%)`
      : t('Mirroring traffic');

    const mirroringEmptyStateText = (
      <>
        {t('Click the ')} <MigrationIcon />{' '}
        {t(
          'icon next to a workload above to mirror traffic to it. Traffic mirroring duplicates incoming requests to the mirrored workload. This allows you to test or analyze a new version safely.'
        )}
      </>
    );

    const mirroringEmptyState = (
      <EmptyState
        headingLevel="h6"
        titleText={t('No mirrored workload selected.')}
        variant={EmptyStateVariant.lg}
        className={emptyStateStyle}
      >
        <EmptyStateBody>{mirroringEmptyStateText}</EmptyStateBody>
      </EmptyState>
    );

    // Use the same column structure as workloadColumns but without header content
    const mirrorColumns: SortableTh[] = [
      {
        title: t('Mirrored workload'),
        width: 30,
        sortable: false
      },
      {
        title: t('Mirror percentage'),
        width: 70,
        sortable: false
      }
    ];

    const mirrorRows = mirroredWorkload
      ? [
          {
            cells: [
              <div>
                <PFBadge badge={PFBadges.MirroredWorkload} position={TooltipPosition.top} />
                {mirroredWorkload.name}
              </div>,
              <RoutingSlider
                id={`slider-mirror-${mirroredWorkload.name}`}
                key={`slider-mirror-${mirroredWorkload.name}`}
                tooltip={true}
                input={true}
                inputFormat="%"
                value={mirroredWorkload.weight}
                min={0}
                max={100}
                maxRailWidth="195px"
                maxLimit={100}
                onSlide={value => {
                  this.onWeight(mirroredWorkload.name, value as number);
                }}
                onSlideStop={value => {
                  this.onWeight(mirroredWorkload.name, value as number);
                }}
                locked={false}
                showLock={false}
                onLock={() => {}}
                mirrored={true}
                showMirror={true}
                onMirror={() => this.onMirror(mirroredWorkload.name, false)}
              />
            ]
          }
        ]
      : [];

    return (
      <>
        <SimpleTable
          label={t('Weighted routing')}
          columns={workloadColumns}
          rows={workloadRows}
          verticalAlign="middle"
        />

        {this.props.showMirror && this.state.workloads.length > 1 && (
          <ExpandableSection
            className={mirroringSectionStyle}
            isExpanded={this.state.mirroringSectionExpanded}
            toggleText={mirroringSectionTitle}
            onToggle={() => {
              this.setState({ mirroringSectionExpanded: !this.state.mirroringSectionExpanded });
            }}
          >
            {mirroredWorkload ? (
              <SimpleTable
                label={t('Mirrored workload')}
                columns={mirrorColumns}
                rows={mirrorRows}
                verticalAlign="middle"
              />
            ) : (
              mirroringEmptyState
            )}
          </ExpandableSection>
        )}

        {this.props.showValid && !isValid && (
          <div className={validationStyle} data-test="traffic-shifting-weight-validation">
            {t(MSG_WEIGHTS_NOT_VALID)}
          </div>
        )}
      </>
    );
  }
}
