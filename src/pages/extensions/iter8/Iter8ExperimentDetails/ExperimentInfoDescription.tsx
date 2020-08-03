import * as React from 'react';
import {
  Badge,
  Card,
  CardActions,
  CardBody,
  CardHead,
  CardHeader,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Dropdown,
  DropdownItem,
  Grid,
  GridItem,
  KebabToggle,
  List,
  ListItem,
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';

import LocalTime from '../../../../components/Time/LocalTime';
import { Link } from 'react-router-dom';
import { Iter8ExpDetailsInfo } from '../../../../types/Iter8';
import { RenderComponentScroll } from '../../../../components/Nav/Page';
import { GraphType } from '../../../../types/Graph';
import history from '../../../../app/History';

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

type MiniGraphCardState = {
  isKebabOpen: boolean;
};

class ExperimentInfoDescription extends React.Component<ExperimentInfoDescriptionProps, MiniGraphCardState> {
  constructor(props) {
    super(props);
    this.state = { isKebabOpen: false };
  }

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

  renderDeployments(baseline: string, kind: string) {
    let linkTo = '/namespaces/' + this.props.namespace + '/workloads/' + baseline;
    if (kind === 'Service') {
      linkTo = '/namespaces/' + this.props.namespace + '/services/' + baseline;
    }
    return (
      <ListItem key={`AppService_${baseline}`}>
        <Link to={linkTo}>{baseline}</Link>
      </ListItem>
    );
  }

  baselineInfo(bname: string, binfo: string, kind: string) {
    const workloadList = this.renderDeployments(binfo, kind);
    let badgeKind = kind === 'Deployment' ? 'W' : 'S';
    return [
      <DataListCell key="workload-icon" isIcon={true}>
        <Badge>{badgeKind}</Badge>
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

  gatewayInfo(badgeKind: string, nameString: string, namespace: string, gatewayname: string) {
    let linkTo = '/namespaces/' + namespace + '/istio/gateways/' + gatewayname;
    return [
      <DataListCell key="workload-icon" isIcon={true}>
        <Badge>{badgeKind}</Badge>
      </DataListCell>,
      <DataListCell key="gateway">
        <Text component={TextVariants.h3}>
          <Link to={linkTo}>{nameString}</Link>
        </Text>
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

  renderCardHead() {
    const graphCardActions = [
      <DropdownItem key="viewGraph" onClick={this.showFullMetric}>
        Show service inbound metrics
      </DropdownItem>,
      <DropdownItem key="viewGraph" onClick={this.showFullGraph}>
        Show traffic graph
      </DropdownItem>
    ];
    return [
      <CardHead>
        <CardActions>
          <Dropdown
            toggle={<KebabToggle onToggle={this.onGraphActionsToggle} />}
            dropdownItems={graphCardActions}
            isPlain
            isOpen={this.state.isKebabOpen}
            position={'right'}
          />
        </CardActions>
        <CardHeader>
          <Title style={{ float: 'left' }} headingLevel="h3" size="2xl">
            {this.props.experimentDetails !== undefined ? this.props.experimentDetails.experimentItem.name : 'N/A'}
          </Title>
        </CardHeader>
      </CardHead>
    ];
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

    let hasHosts = this.props.experimentDetails
      ? this.props.experimentDetails.hosts.length > 0
        ? true
        : false
      : false;
    return (
      <RenderComponentScroll>
        <Grid gutter="md" style={{ margin: '10px' }}>
          <GridItem span={6}>
            <Card style={{ height: '100%' }}>
              {this.props.experimentDetails?.experimentItem.kind === 'Deployment' ? this.renderCardHead() : ''}
              <CardBody>
                <DataList aria-label="baseline and candidate">
                  {this.props.experimentDetails?.experimentItem.kind === 'Deployment' ? (
                    <DataListItem aria-labelledby="target">
                      <DataListItemRow>
                        <DataListItemCells dataListCells={this.serviceInfo()} />
                        <DataListItemCells dataListCells={this.serviceLinkCell(targetNamespace, targetService)} />
                      </DataListItemRow>
                    </DataListItem>
                  ) : (
                    ''
                  )}

                  <DataListItem aria-labelledby="Baseline">
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={this.baselineInfo(
                          'Baseline',
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.baseline : '',
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.kind : ''
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
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.candidate : '',
                          this.props.experimentDetails ? this.props.experimentDetails.experimentItem.kind : ''
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
                  {hasHosts ? (
                    <DataListItem aria-labelledby="Gateway">
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={this.gatewayInfo(
                            'G',
                            this.props.experimentDetails ? this.props.experimentDetails.hosts[0].name : '',
                            this.props.namespace,
                            this.props.experimentDetails ? this.props.experimentDetails.hosts[0].gateway : ''
                          )}
                        />
                      </DataListItemRow>
                    </DataListItem>
                  ) : (
                    <></>
                  )}
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

  private onGraphActionsToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  private showFullGraph = () => {
    let graphType: GraphType = GraphType.WORKLOAD;
    const graphUrl = `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${this.props.namespace}&unusedNodes=false&edges=requestsPercentage&`;
    history.push(graphUrl);
  };

  private showFullMetric = () => {
    const graphUrl = `/namespaces/${this.props.namespace}/services/${this.props.target}?tab=metrics&bylbl=destination_version`;

    if (this.props.experimentDetails !== undefined) {
      const params = `=${this.props.experimentDetails.experimentItem.baselineVersion},${this.props.experimentDetails.experimentItem.candidateVersion}`;
      history.push(graphUrl + encodeURIComponent(params));
    } else {
      history.push(graphUrl);
    }
  };
}

export default ExperimentInfoDescription;
