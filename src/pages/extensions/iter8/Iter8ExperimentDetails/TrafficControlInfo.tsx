import * as React from 'react';
import { TrafficControl } from '../../../../types/Iter8';
import { IRow, Table, TableBody, TableHeader } from '@patternfly/react-table';
import {
  Card,
  CardBody,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  FlexItem,
  GridItem,
  PopoverPosition,
  Text,
  Title,
  Tooltip
} from '@patternfly/react-core';
import equal from 'fast-deep-equal';
import { style } from 'typestyle';
import { KialiIcon } from '../../../../config/KialiIcon';

const infoStyle = style({
  margin: '0px 16px 2px 4px'
});
const containerPadding = style({ padding: '20px' });

interface TrafficControlInfoProps {
  trafficControl: TrafficControl;
}

type State = {
  columns: any;
  rows: any;
};

class TrafficControlInfo extends React.Component<TrafficControlInfoProps, State> {
  constructor(props: TrafficControlInfoProps) {
    super(props);
    this.state = {
      columns: [{ title: 'Rule order' }, 'Request Matching'],
      rows: []
    };
  }

  componentDidMount() {
    this.setState(() => {
      return {
        rows: this.getRows()
      };
    });
  }

  componentDidUpdate(prevProps) {
    if (!equal(this.props.trafficControl, prevProps.trafficControl)) {
      this.setState(() => {
        return {
          rows: this.getRows()
        };
      });
    }
  }

  getRows = (): IRow[] => {
    let rows: IRow[] = [];
    this.props.trafficControl?.match?.http?.map((matchRule, idx) => {
      const matchString: string[] = [];
      matchRule.headers?.map(h => {
        matchString.push('headers [' + h.key + '] ' + h.match + ' ' + h.stringMatch + ' ');
      });
      if (matchRule.uri?.match) {
        matchString.push('uri ' + matchRule.uri.match + ' ' + matchRule.uri.stringMatch);
      }

      rows.push({
        cells: [
          { title: <> {idx + 1} </> },
          {
            title: (
              <>
                {matchString.map((match, i) => (
                  <div key={'match_' + i}>{match}</div>
                ))}
              </>
            )
          }
        ]
      });
    });
    return rows;
  };

  render() {
    const { columns, rows } = this.state;
    return (
      <Grid>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <DataList aria-label="detailTraffic">
                <DataListItem aria-labelledby="altorighm">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={
                        <DataListCell key="strategy">
                          <Text>
                            <b>Traffic Strategy</b>
                            <Tooltip
                              key={'winnerTooltip'}
                              aria-label={'Winner Tooltip'}
                              position={PopoverPosition.auto}
                              maxWidth="30rem"
                              content={
                                <table>
                                  <tr className={'tr'}>
                                    <td style={{ verticalAlign: 'top' }}>
                                      <div style={{ width: '100px' }}>progressive:</div>
                                    </td>
                                    <td>Progressively shift all traffic to the winner.</td>
                                  </tr>
                                  <tr>
                                    <td>top_2:&nbsp;</td>
                                    <td>Converge towards a 50-50 traffic split between the best two versions</td>
                                  </tr>
                                  <tr>
                                    <td>uniform:&nbsp;</td>
                                    <td>Converge towards a uniform traffic split across all versions.</td>
                                  </tr>
                                </table>
                              }
                            >
                              <KialiIcon.Info className={infoStyle} />
                            </Tooltip>
                            : {this.props.trafficControl.strategy ? this.props.trafficControl.strategy : 'progressive'}
                          </Text>
                        </DataListCell>
                      }
                    />
                    <DataListItemCells
                      dataListCells={
                        <DataListCell key="strategy">
                          <Text>
                            <b>Max Increment </b>
                            <Tooltip
                              key={'winnerTooltip'}
                              aria-label={'Winner Tooltip'}
                              position={PopoverPosition.auto}
                              content={
                                <>
                                  Specifies the maximum percentage by which traffic routed to a candidate can increase
                                  during a single iteration of the experiment. Default value: 2 (percent)
                                </>
                              }
                            >
                              <KialiIcon.Info className={infoStyle} />
                            </Tooltip>
                            : {this.props.trafficControl.maxIncrement} {'%'}
                          </Text>
                        </DataListCell>
                      }
                    />
                    <DataListItemCells
                      dataListCells={
                        <DataListCell key="strategy">
                          <Text>
                            <b>On Termination </b>
                            <Tooltip
                              key={'winnerTooltip'}
                              aria-label={'Winner Tooltip'}
                              position={PopoverPosition.auto}
                              maxWidth="30rem"
                              content={
                                <table>
                                  <tr className={'tr'}>
                                    <td style={{ verticalAlign: 'top' }}>
                                      <div style={{ width: '100px' }}>to_winner:</div>
                                    </td>
                                    <td>
                                      ensures that, if a winning version is found at the end of the experiment, all
                                      traffic will flow to this version after the experiment terminates.
                                    </td>
                                  </tr>
                                  <tr>
                                    <td>to_baseline:</td>
                                    <td>
                                      {' '}
                                      F ensure that all traffic will flow to the baseline version, after the experiment
                                      terminates
                                    </td>
                                  </tr>
                                  <tr>
                                    <td>keep_last:</td>
                                    <td>
                                      ensure that the traffic split used during the final iteration of the experiment
                                      continues even after the experiment has terminated.
                                    </td>
                                  </tr>
                                </table>
                              }
                            >
                              <KialiIcon.Info className={infoStyle} />
                            </Tooltip>
                            :{' '}
                            {this.props.trafficControl.onTermination
                              ? this.props.trafficControl.onTermination
                              : 'to_winner'}
                          </Text>
                        </DataListCell>
                      }
                    />
                  </DataListItemRow>
                </DataListItem>
              </DataList>

              <FlexItem>
                <div className={containerPadding}>
                  <Title headingLevel="h6" size="lg">
                    Match Rules
                    <Tooltip
                      key={'winnerTooltip'}
                      aria-label={'Winner Tooltip'}
                      position={PopoverPosition.auto}
                      content={
                        <>
                          Match rules used to filter out incoming traffic. With protocol name as a key, its value is an
                          array of Istio matching clauses. Currently, only http is supported
                        </>
                      }
                    >
                      <KialiIcon.Info className={infoStyle} />
                    </Tooltip>
                  </Title>

                  <Table aria-label="Compound expandable table" rows={this.getRows()} cells={columns}>
                    <TableHeader />
                    {rows.length > 0 ? (
                      <TableBody />
                    ) : (
                      <tr>
                        <td colSpan={columns.length}>
                          <EmptyState variant={EmptyStateVariant.full}>
                            <Title headingLevel="h5" size="lg">
                              No Match Rule found
                            </Title>
                            <EmptyStateBody>No Match Rules is defined in Experiment</EmptyStateBody>
                          </EmptyState>
                        </td>
                      </tr>
                    )}
                  </Table>
                </div>
              </FlexItem>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    );
  }
}

export default TrafficControlInfo;
