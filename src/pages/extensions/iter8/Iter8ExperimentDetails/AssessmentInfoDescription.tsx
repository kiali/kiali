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
import { ChartBullet, ChartLegend, ChartThemeColor, ChartThemeVariant } from '@patternfly/react-charts';

import {
  emptyExperimentItem,
  Iter8Experiment,
  Iter8Info,
  MetricProgressInfo,
  Statistics
} from '../../../../types/Iter8';
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
import { TimeInMilliseconds } from '../../../../types/Common';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { KialiAppState } from '../../../../store/Store';
import { durationSelector, lastRefreshAtSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import * as API from '../../../../services/Api';

interface AssesmentInfoDescriptionProps {
  lastRefreshAt: TimeInMilliseconds;
  iter8Info: Iter8Info;
  name: string;
  namespace: string;
  experimentItem: Iter8Experiment;
  metricInfo: Map<string, MetricProgressInfo>;
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
    if (
      this.props.experimentItem !== prevProps.experimentItem ||
      prevProps.lastRefreshAt !== this.props.lastRefreshAt
    ) {
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

  getLegend(total, idx) {
    const shown = idx === total - 1 ? "{[{ name: 'Current Measurement'}]}" : '{}';
    return shown;
  }

  renderTresholdBar(total, idx, name, statistics: Statistics) {
    let value = statistics.value;
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

    maxDomain = value > maxDomain ? Number(value.toFixed(2)) : Number(maxDomain.toFixed(2));

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
    let marginBottom =
      idx === total - 1 ? (statistics.ratio_statistics?.credible_interval.upper != null ? 120 : 100) : 0;
    let height = idx === total - 1 ? 20 : 110;

    let lowerCredible =
      statistics.ratio_statistics?.credible_interval.upper != null
        ? [{ name: 'Credible Lower Range', y: statistics.ratio_statistics.credible_interval.lower }]
        : [];
    let higherCredible =
      statistics.ratio_statistics?.credible_interval.upper != null
        ? [{ name: 'Credible Upper Range', y: statistics.ratio_statistics.credible_interval.upper }]
        : [];
    let dataLegend =
      statistics.ratio_statistics?.credible_interval.upper != null
        ? [
            { name: 'Credible Lower Range', symbol: { type: 'minus' } },
            { name: 'Credible Higher Range', symbol: { type: 'minus' } },
            { name: 'Exception' },
            { name: 'Threshold' },
            { name: 'Measurement inside threshold' },
            { name: 'Measurement outside threshold' }
          ]
        : [
            { name: 'Exception' },
            { name: 'Threshold' },
            { name: 'Measurement inside threshold' },
            { name: 'Measurement outside threshold' }
          ];
    let colorScale =
      statistics.ratio_statistics?.credible_interval.upper != null
        ? ['#ec7a08', '#c9190a', '#ededed', '#d2d2d2', '#0466cc', '#ec7a08']
        : ['#ededed', '#d2d2d2', '#0466cc', '#ec7a08'];
    let legendHeight = statistics.ratio_statistics?.credible_interval.upper != null ? 60 : 40;
    return (
      <>
        {idx === 0 ? '' : <Divider />}
        <Grid gutter="md">
          <GridItem span={4}>{name}</GridItem>
          <GridItem span={2}>{valueString}</GridItem>
          <GridItem span={6}>
            <div style={{ marginTop: -50, marginBottom: marginBottom }}>
              <ChartBullet
                qualitativeRangeData={[
                  { name: range1Name, y: range1 },
                  { name: range2Name, y: range2 }
                ]}
                maxDomain={{ y: Number(maxDomain) }}
                comparativeWarningMeasureData={lowerCredible}
                comparativeErrorMeasureData={higherCredible}
                primarySegmentedMeasureData={[{ name: 'Current ', y: valueString }]}
                constrainToVisibleArea
                themeColor={color}
                themeVariant={ChartThemeVariant.dark}
                padding={{ bottom: 0, left: 0, right: 0, top: 0 }}
                height={height}
                standalone={true}
                labels={({ datum }) => `${datum.name}: ${datum.y}`}
                legendPosition="bottom"
              />
            </div>

            {idx === total - 1 ? (
              <>
                <ChartLegend
                  data={dataLegend}
                  style={{ labels: { fontSize: 12 } }}
                  colorScale={colorScale}
                  itemsPerRow={2}
                  height={legendHeight}
                />
              </>
            ) : (
              <></>
            )}
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
                      {this.renderTresholdBar(assessment.criterionAssessment.length, i, c.metric_id, c.statistics)}
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
        <RenderComponentScroll>
          <Grid gutter="md">
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
