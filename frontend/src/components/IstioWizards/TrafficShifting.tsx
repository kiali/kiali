import * as React from 'react';
import { Slider } from './Slider/Slider';
import { WorkloadOverview } from '../../types/ServiceInfo';
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
import { SimpleTable, SortableTh } from 'components/Table/SimpleTable';
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

const validationStyle = kialiStyle({
  marginBottom: '0.5rem',
  color: PFColors.Red100,
  textAlign: 'right'
});

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

export const MSG_WEIGHTS_NOT_VALID = 'The sum of all non-mirrored weights must be 100 %';

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

  onLock = (workloadName: string, locked: boolean): void => {
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

  onMirror = (workloadName: string, mirrored: boolean): void => {
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
          // Auto-expand section when mirroring is enabled
          mirroringSectionExpanded: mirrored ? true : prevState.mirroringSectionExpanded,
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

            <Slider
              id={`slider-${workload.name}`}
              key={`slider-${workload.name}`}
              tooltip={true}
              input={true}
              inputFormat="%"
              value={workload.weight}
              min={0}
              max={workload.maxWeight}
              maxWidth="195px"
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
              <Slider
                id={`slider-mirror-${mirroredWorkload.name}`}
                key={`slider-mirror-${mirroredWorkload.name}`}
                tooltip={false}
                input={true}
                inputFormat="%"
                value={mirroredWorkload.weight}
                min={0}
                max={100}
                maxWidth="195px"
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

        {this.props.showValid && !isValid && <div className={validationStyle}>{MSG_WEIGHTS_NOT_VALID}</div>}
      </>
    );
  }
}
