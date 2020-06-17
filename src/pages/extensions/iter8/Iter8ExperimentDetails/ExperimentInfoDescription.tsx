import * as React from 'react';
import {
  Badge,
  Card,
  CardBody,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Grid,
  GridItem,
  List,
  ListItem,
  Stack,
  StackItem,
  Text,
  TextVariants
} from '@patternfly/react-core';

import LocalTime from '../../../../components/Time/LocalTime';
import { Link } from 'react-router-dom';
import { Iter8ExpDetailsInfo } from '../../../../types/Iter8';
import { RenderComponentScroll } from '../../../../components/Nav/Page';

interface ExperimentInfoDescriptionProps {
  target: string;
  namespace: string;
  experimentDetails?: Iter8ExpDetailsInfo;
  experiment: string;
  duration: number;
  baseline: string;
  candidate: string;
  actionTaken: string;
}

class ExperimentInfoDescription extends React.Component<ExperimentInfoDescriptionProps> {
  serviceLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/services/' + workload;
  }

  serviceInfo() {
    return [
      <DataListCell key="service-icon" isIcon={true}>
        <Badge>S</Badge>
      </DataListCell>,
      <DataListCell key="targetService">
        <Text component={TextVariants.h3}>Service</Text>
      </DataListCell>
    ];
  }

  serviceLinkCell(namespace: string, bname: string) {
    return [
      <DataListCell key={bname}>
        <Text component={TextVariants.h3}>
          <Link to={this.serviceLink(namespace, bname)}>{bname}</Link>
        </Text>
      </DataListCell>
    ];
  }
  workloadLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/workloads/' + workload;
  }

  renderDeployments(baseline: string) {
    return (
      <ListItem key={`AppService_${baseline}`}>
        <Link to={this.workloadLink(this.props.namespace, baseline)}>{baseline}</Link>
      </ListItem>
    );
  }

  baselineInfo(bname: string, binfo: string) {
    const workloadList = this.renderDeployments(binfo);

    return [
      <DataListCell key="workload-icon" isIcon={true}>
        <Badge>W</Badge>
      </DataListCell>,
      <DataListCell key="baseline">
        <Text component={TextVariants.h3}>{bname}</Text>
        <List>{workloadList}</List>
      </DataListCell>
    ];
  }

  percentageInfo(bname: string, bpercentage: number) {
    return [
      <DataListCell key={bname}>
        <Text component={TextVariants.h3}>Percentage</Text>
        <Text>{bpercentage} %</Text>
      </DataListCell>
    ];
  }

  getConclusionList(conclusions: string[]) {
    return (
      <ul>
        {conclusions.map((sub, subIdx) => {
          return <li key={subIdx}>{sub}</li>;
        })}
      </ul>
    );
  }

  render() {
    let targetNamespace = this.props.experimentDetails
      ? this.props.experimentDetails.experimentItem.targetServiceNamespace
      : this.props.namespace;
    let targetService = this.props.experimentDetails
      ? this.props.experimentDetails.experimentItem.targetService
      : this.props.target;
    let statusString = this.props.experimentDetails ? this.props.experimentDetails.experimentItem.status : '';
    if (this.props.actionTaken !== '') {
      statusString = 'Waiting for result of action "' + this.props.actionTaken + '" ';
    }
    return (
      <RenderComponentScroll>
        <Grid gutter="md" style={{ margin: '10px' }}>
          <GridItem span={6}>
            <Card style={{ height: '100%' }}>
              <CardBody>
                <DataList aria-label="baseline and candidate">
                  <DataListItem aria-labelledby="target">
                    <DataListItemRow>
                      <DataListItemCells dataListCells={this.serviceInfo()} />
                      <DataListItemCells dataListCells={this.serviceLinkCell(targetNamespace, targetService)} />
                    </DataListItemRow>
                  </DataListItem>

                  <DataListItem aria-labelledby="Baseline">
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={this.baselineInfo(
                          'Baseline',
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.baseline : ''
                        )}
                      />
                      <DataListItemCells
                        dataListCells={this.percentageInfo(
                          'Baseline',
                          this.props.experimentDetails
                            ? this.props.experimentDetails.experimentItem.baselinePercentage
                            : 0
                        )}
                      />
                    </DataListItemRow>
                  </DataListItem>
                  <DataListItem aria-labelledby="Candidate">
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={this.baselineInfo(
                          'Candidate',
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.candidate : ''
                        )}
                      />
                      <DataListItemCells
                        dataListCells={this.percentageInfo(
                          'Candidate',
                          this.props.experimentDetails
                            ? this.props.experimentDetails.experimentItem.candidatePercentage
                            : 0
                        )}
                      />
                    </DataListItemRow>
                  </DataListItem>
                </DataList>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={6}>
            <Card style={{ height: '100%' }}>
              <CardBody>
                <Stack gutter="md" style={{ marginTop: '10px' }}>
                  <StackItem id={'Status'}>
                    <Text component={TextVariants.h3}> Status: </Text>
                    {statusString}
                  </StackItem>
                  <StackItem id={'Status'}>
                    <Text component={TextVariants.h3}> Phase: </Text>
                    {this.props.experimentDetails ? this.props.experimentDetails.experimentItem.phase : ''}
                  </StackItem>
                  <StackItem id={'assessment'}>
                    <Text component={TextVariants.h3}> Assessment: </Text>
                    {this.props.experimentDetails && this.props.experimentDetails.experimentItem.assessmentConclusion
                      ? this.getConclusionList(this.props.experimentDetails.experimentItem.assessmentConclusion)
                      : ''}
                  </StackItem>
                  <StackItem>
                    <Grid>
                      <GridItem span={4}>
                        <StackItem id={'started_at'}>
                          <Text component={TextVariants.h3}> Created at </Text>
                          <LocalTime
                            time={
                              this.props.experimentDetails && this.props.experimentDetails.experimentItem.createdAt
                                ? new Date(
                                    this.props.experimentDetails.experimentItem.createdAt / 1000000
                                  ).toISOString()
                                : ''
                            }
                          />
                        </StackItem>
                      </GridItem>
                      <GridItem span={4}>
                        <StackItem id={'started_at'}>
                          <Text component={TextVariants.h3}> Started at </Text>
                          <LocalTime
                            time={
                              this.props.experimentDetails && this.props.experimentDetails.experimentItem.startedAt
                                ? new Date(
                                    this.props.experimentDetails.experimentItem.startedAt / 1000000
                                  ).toISOString()
                                : ''
                            }
                          />
                        </StackItem>
                      </GridItem>
                      <GridItem span={4}>
                        <StackItem id={'ended_at'}>
                          <Text component={TextVariants.h3}> Ended at </Text>
                          <LocalTime
                            time={
                              this.props.experimentDetails && this.props.experimentDetails.experimentItem.endedAt
                                ? new Date(this.props.experimentDetails.experimentItem.endedAt / 1000000).toISOString()
                                : ''
                            }
                          />
                        </StackItem>
                      </GridItem>
                    </Grid>
                  </StackItem>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

export default ExperimentInfoDescription;
