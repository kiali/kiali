import * as React from 'react';
import {
  Divider,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  PopoverPosition,
  Title,
  Tooltip
} from '@patternfly/react-core';
import { ChartBullet, ChartThemeColor } from '@patternfly/react-charts';

import { emptyExperimentItem, Iter8Experiment, Iter8Info, MetricProgressInfo } from '../../../../types/Iter8';
import {
  cellWidth,
  expandable,
  ICell,
  IRow,
  RowWrapperProps,
  Table,
  TableBody,
  TableHeader
} from '@patternfly/react-table';
import { KialiIcon } from '../../../../config/KialiIcon';
import { style } from 'typestyle';
import { css } from '@patternfly/react-styles';
import { RenderComponentScroll } from '../../../../components/Nav/Page';
import styles from '@patternfly/react-styles/css/components/Table/table';
import { DurationInSeconds, TimeInMilliseconds } from '../../../../types/Common';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { DurationDropdownContainer } from '../../../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../../../components/Refresh/RefreshButton';
import { RightActionBar } from '../../../../components/RightActionBar/RightActionBar';
import { KialiAppState } from '../../../../store/Store';
import { durationSelector, lastRefreshAtSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import * as API from '../../../../services/Api';

const classNames = require('classnames');
const paddingStyle = style({ padding: '0px 0px 0px 0px' });

interface AssesmentInfoDescriptionProps {
  lastRefreshAt: TimeInMilliseconds;
  iter8Info: Iter8Info;
  name: string;
  namespace: string;
  experimentItem: Iter8Experiment;
  metricInfo: Map<string, MetricProgressInfo>;
  duration: DurationInSeconds;
  fetchOp: () => void;
}

type State = {
  experimentItem: Iter8Experiment;
  columns: any;
  rows: any;
};

const statusIconStyle = style({
  fontSize: '2.0em'
});

const infoStyle = style({
  margin: '0px 16px 2px 4px'
});

class AssessmentInfoDescriptionTab extends React.Component<AssesmentInfoDescriptionProps, State> {
  constructor(props: AssesmentInfoDescriptionProps) {
    super(props);
    this.state = {
      experimentItem: emptyExperimentItem,
      columns: [
        { title: 'Type', cellFormatters: [expandable], transforms: [cellWidth(10) as any] },
        'Assessment',
        'Statistics'
      ],
      rows: this.getRows()
    };
  }

  componentDidMount() {
    this.setState({
      experimentItem: this.props.experimentItem,
      rows: this.getRows()
    });
  }

  componentDidUpdate(prevProps: AssesmentInfoDescriptionProps) {
    if (this.props.experimentItem !== prevProps.experimentItem || prevProps.duration !== this.props.duration) {
      this.renderRows();
    }
  }

  fetchAssesment = () => {
    const namespace = this.props.namespace;
    const name = this.props.name;
    API.getExperiment(namespace, name)
      .then(result => {
        this.setState({
          experimentItem: result.data.experimentItem,
          rows: this.getRows()
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Iter8 Experiment', error);
      });
  };

  renderRows() {
    this.setState({
      experimentItem: this.props.experimentItem,
      rows: this.getRows()
    });
  }

  renderTresholdBar(idx, name, value) {
    if (value === undefined) {
      return (
        <>
          {idx === 0 ? '' : <Divider />}
          <Grid gutter="md">
            <GridItem span={4}>{name}:</GridItem>
            <GridItem span={2}>{value}</GridItem>
            <GridItem span={6}></GridItem>
          </Grid>
        </>
      );
    }
    let valueString = value.toFixed(2);
    let tInfo = this.props.metricInfo.get(name);
    if (tInfo === undefined) return <></>;

    let baseLineValue = 1;
    if (tInfo.thresholdType === 'relative') {
      this.props.experimentItem.baseline.criterionAssessment?.map((ca, _) => {
        if (ca.metric_id === name) baseLineValue = ca.statistics.value;
      });
    }

    let basethreshold = Number((tInfo.threshold * baseLineValue).toFixed(2));
    let maxDomain = basethreshold * 1.5;
    if (tInfo.threshold === 0) {
      maxDomain = Number((Number((this.getMaxThreshold(name) * baseLineValue).toFixed(2)) * 1.1).toFixed(0));
    }

    maxDomain = value > maxDomain ? value.toFixed(2) : maxDomain.toFixed(2);

    let color;
    let range1 = 0;
    let range2 = basethreshold;
    if (tInfo.preferred_direction !== undefined && tInfo.preferred_direction === 'lower') {
      if (value >= basethreshold) {
        color = ChartThemeColor.orange;
      } else {
        color = ChartThemeColor.blue;
      }
    } else {
      range1 = basethreshold;
      range2 = maxDomain;
      if (value >= basethreshold) {
        color = ChartThemeColor.blue;
      } else {
        color = ChartThemeColor.orange;
      }
    }
    let range1Name = 'Lower limit';
    let range2Name = 'Range';
    if (range1 === 0) {
      range1Name = '';
      if (tInfo.threshold !== 0) {
        range2Name = 'Upper Limit';
      }
    }
    return (
      <>
        {idx === 0 ? '' : <Divider />}
        <Grid gutter="md">
          <GridItem span={4}>{name}</GridItem>
          <GridItem span={2}>{valueString}</GridItem>
          <GridItem span={6}>
            <div className={classNames(paddingStyle)}>
              <ChartBullet
                legendPosition={'right'}
                qualitativeRangeData={[
                  { name: range1Name, y: range1 },
                  { name: range2Name, y: range2 }
                ]}
                maxDomain={{ y: Number(maxDomain) }}
                primarySegmentedMeasureData={[{ name: 'Measure', y: valueString }]}
                constrainToVisibleArea
                themeColor={color}
                padding={{
                  bottom: 0,
                  left: 0,
                  right: 0,
                  top: 0
                }}
                height={110}
                standalone={true}
                labels={({ datum }) => `${datum.name}: ${datum.y}`}
              />
            </div>
          </GridItem>
        </Grid>
      </>
    );
  }

  renderRow(type, assessment) {
    return {
      cells: [
        { title: <>{type}</> },
        {
          title: (
            <>
              {this.props.experimentItem?.winner.winning_version_found &&
              this.props.experimentItem?.winner.name === assessment.name ? (
                <Grid gutter="md">
                  <GridItem span={6}>
                    Winner
                    <Tooltip
                      key={'winnerTooltip'}
                      aria-label={'Winner Tooltip'}
                      position={PopoverPosition.auto}
                      className={'health_indicator'}
                      content={<>{'Winning version identified by iter8 analytics'}</>}
                    >
                      <KialiIcon.Info className={infoStyle} />
                    </Tooltip>
                  </GridItem>
                  <GridItem span={6}>
                    {' '}
                    <KialiIcon.Ok className={statusIconStyle} />
                  </GridItem>
                </Grid>
              ) : (
                <></>
              )}
              <Grid gutter="md">
                <GridItem span={6}>Name:</GridItem>
                <GridItem span={6}>{assessment.name}</GridItem>
              </Grid>
              <Grid gutter="md">
                <GridItem span={6}>Weight:</GridItem>
                <GridItem span={6}>{assessment.weight}</GridItem>
              </Grid>
              <Grid gutter="md">
                <GridItem span={6}>Win Probability:</GridItem>
                <GridItem span={6}>{assessment.winProbability}</GridItem>
              </Grid>
              <Grid gutter="md">
                <GridItem span={6}>Request Count:</GridItem>
                <GridItem span={6}>{assessment.requestCount}</GridItem>
              </Grid>
            </>
          )
        },
        {
          props: { nonPadding: true },
          title: (
            <>
              {assessment.criterionAssessment &&
                assessment.criterionAssessment.map((c, i) => {
                  return (
                    <Grid gutter="md">
                      <GridItem span={12}>{this.renderTresholdBar(i, c.metric_id, c.statistics.value)}</GridItem>
                    </Grid>
                  );
                })}
            </>
          )
        }
      ]
    };
  }

  getRows = (): IRow[] => {
    let rows: IRow[] = [];

    rows.push(this.renderRow('Baseline', this.props.experimentItem?.baseline));
    this.props.experimentItem?.candidates.map(assessment => {
      rows.push(this.renderRow('Candidate', assessment));
      return rows;
    });
    return rows;
  };

  getMaxThreshold = (name): number => {
    let threshold = 0;
    this.props.experimentItem.baseline.criterionAssessment?.map((c, _) => {
      if (c.metric_id === name) {
        threshold = c.statistics.value;
      }
    });
    this.props.experimentItem.candidates.map(assessment => {
      if (assessment.criterionAssessment !== undefined) {
        assessment.criterionAssessment.map((c, _) => {
          if (c.metric_id === name && c.statistics.value > threshold) {
            threshold = c.statistics.value;
          }
          return threshold;
        });
      }
      return threshold;
    });
    return threshold;
  };

  columns = (): ICell[] => {
    return [{ title: 'Name', transforms: [cellWidth(15) as any] }, { title: 'Template' }];
  };

  getIcon = (s: number) => {
    switch (s) {
      case 1:
        return (
          <Tooltip content={<>{s}</>}>
            <KialiIcon.Ok className={statusIconStyle} />
          </Tooltip>
        );
      case 0:
        return (
          <Tooltip content={<>{s}</>}>
            <KialiIcon.Error className={statusIconStyle} />
          </Tooltip>
        );
      default:
        return s;
    }
  };

  customRowWrapper = ({ trRef, className, rowProps, row: { isExpanded, isHeightAuto }, ...props }) => {
    const dangerErrorStyle = {
      borderLeft: '3px solid var(--pf-global--primary-color--100)'
    };

    return (
      <tr
        {...props}
        ref={trRef}
        className={css(
          className,
          'custom-static-class',
          isExpanded !== undefined && styles.tableExpandableRow,
          isExpanded && styles.modifiers.expanded,
          isHeightAuto && styles.modifiers.heightAuto
        )}
        hidden={isExpanded !== undefined && !isExpanded}
        style={dangerErrorStyle}
      />
    );
  };

  render() {
    const { columns, rows } = this.state;
    return (
      <>
        <RightActionBar>
          <DurationDropdownContainer id="assesment-duration-dropdown" prefix="Last" />
          <RefreshButtonContainer handleRefresh={this.fetchAssesment} />
        </RightActionBar>
        <RenderComponentScroll>
          <Grid gutter="md" style={{ margin: '10px' }}>
            <GridItem span={12}>
              <Table
                aria-label="SpanTable"
                className={'spanTracingTagsTable'}
                rows={rows}
                cells={columns}
                rowWrapper={(props: RowWrapperProps) =>
                  this.customRowWrapper({
                    trRef: props.trRef,
                    className: props.className,
                    rowProps: props.rowProps,
                    row: props.row as any,
                    ...props
                  })
                }
              >
                <TableHeader />
                {rows.length > 0 ? (
                  <TableBody />
                ) : (
                  <tr>
                    <td colSpan={columns.length}>
                      <EmptyState variant={EmptyStateVariant.full}>
                        <Title headingLevel="h5" size="lg">
                          No Criteria found
                        </Title>
                        <EmptyStateBody>Experiment has not been started</EmptyStateBody>
                      </EmptyState>
                    </td>
                  </tr>
                )}
              </Table>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  lastRefreshAt: lastRefreshAtSelector(state)
});

const AssessmentInfoDescription = connect(mapStateToProps, null)(AssessmentInfoDescriptionTab);

export default AssessmentInfoDescription;
