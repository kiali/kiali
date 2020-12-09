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
  PopoverPosition,
  Stack,
  StackItem,
  Tab,
  Tabs,
  Text,
  TextVariants,
  Title,
  Tooltip
} from '@patternfly/react-core';

import LocalTime from '../../../../components/Time/LocalTime';
import * as API from '../../../../services/Api';
import { Link } from 'react-router-dom';
import { Iter8ExpDetailsInfo } from '../../../../types/Iter8';
import { RenderComponentScroll } from '../../../../components/Nav/Page';
import { GraphType } from '../../../../types/Graph';
import history from '../../../../app/History';
import jsyaml from 'js-yaml';
import YAML from 'yaml';
import { KialiIcon } from '../../../../config/KialiIcon';
import { style } from 'typestyle';
import equal from 'fast-deep-equal';
import TrafficControlInfo from './TrafficControlInfo';
import ErrorBoundaryWithMessage from '../../../../components/ErrorBoundary/ErrorBoundaryWithMessage';
import { PfColors } from '../../../../components/Pf/PfColors';

interface ExperimentInfoDescriptionProps {
  target: string;
  namespace: string;
  experimentDetails: Iter8ExpDetailsInfo;
  experiment: string;
  actionTaken: string;
}

type ExperimentInfoState = {
  isKebabOpen: boolean;
  isUpdated: boolean;
};

const infoStyle = style({
  margin: '0px 16px 2px 4px'
});

class ExperimentInfoDescription extends React.Component<ExperimentInfoDescriptionProps, ExperimentInfoState> {
  constructor(props) {
    super(props);

    this.state = {
      isKebabOpen: false,
      isUpdated: false
    };
  }

  serviceLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/services/' + workload;
  }

  serviceInfo() {
    return [
      <DataListCell key="service-icon" isIcon={true}>
        <Badge className={'virtualitem_badge_definition'}>S</Badge>
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
        <Badge className={'virtualitem_badge_definition'}>{badgeKind}</Badge>
      </DataListCell>,
      <DataListCell key={bname}>
        <Text component={TextVariants.h3}>{bname}</Text>
        <List>{workloadList}</List>
      </DataListCell>
    ];
  }

  candidatesInfo() {
    this.props.experimentDetails?.experimentItem.candidates.map(can => {
      let kind = this.props.experimentDetails?.experimentItem.kind
        ? this.props.experimentDetails?.experimentItem.kind
        : 'Deployment';
      return this.baselineInfo('Candidate', can.name, kind);
    });
  }

  percentageInfo(bname: string, bpercentage: number) {
    return [
      <DataListCell key={bname}>
        <Text component={TextVariants.h3}>Weight</Text>
        <Text>{bpercentage} %</Text>
      </DataListCell>
    ];
  }

  defaultTab() {
    return 'trafficControl';
  }

  gatewayInfo(badgeKind: string, namespace: string, gatewayname: string) {
    let linkTo = '/namespaces/' + namespace + '/istio/gateways/' + gatewayname;
    return [
      <DataListCell key="workload-icon" isIcon={true}>
        <Badge className={'virtualitem_badge_definition'}>{badgeKind}</Badge>
      </DataListCell>,
      <DataListCell key="gateway">
        <Text>Gateway</Text>
        <Text component={TextVariants.h3}>
          <Link to={linkTo}>{gatewayname}</Link>
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

  onDownloadClick = () => {
    API.getExperimentYAML(this.props.namespace, this.props.experimentDetails.experimentItem.name)
      .then(response => response.data)
      .then(data => {
        const url = window.URL.createObjectURL(
          new Blob([YAML.stringify(jsyaml.safeLoad(JSON.stringify(data, null, 2)))], { type: 'application/json' })
        );
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', this.props.experimentDetails.experimentItem.name + `.yaml`);
        // 3. Append to html page
        document.body.appendChild(link); // 4. Force download
        link.click(); // 5. Clean up and remove the link
        link.parentNode?.removeChild(link);
      });
  };

  renderCardHead() {
    const graphCardActions = [
      <DropdownItem key="viewGraph" onClick={this.showFullMetric}>
        Show service inbound metrics
      </DropdownItem>,
      <DropdownItem key="viewGraph" onClick={this.showFullGraph}>
        Show traffic graph
      </DropdownItem>,
      <DropdownItem key="viewGraph" onClick={this.onDownloadClick}>
        Download Experiment YAML
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
            <Badge className={'virtualitem_badge_definition'}>{this.props.experimentDetails.experimentType}</Badge>
            &nbsp;&nbsp;
            {this.props.experimentDetails.experimentItem.name}
          </Title>
        </CardHeader>
      </CardHead>
    ];
  }

  componentDidUpdate(prevProps) {
    if (!equal(this.props.experiment, prevProps.experiment)) {
      this.setState({ isUpdated: true });
    } else if (equal(this.props.experiment, prevProps.experiment) && this.state.isUpdated) {
      this.setState({ isUpdated: false });
    }
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
      ? this.props.experimentDetails.networking && this.props.experimentDetails.networking.hosts
        ? this.props.experimentDetails.networking.hosts.length > 0
        : false
      : false;
    let winnerInfo = '';
    let additionInfo = '';
    if (this.props.experimentDetails.experimentItem.status.indexOf('Abort') > 0) {
      winnerInfo = ' (Tentative)';
      additionInfo = ' at the time of Termination(Abort).';
    }
    return (
      <>
        <RenderComponentScroll>
          <Grid gutter="md">
            <GridItem span={12}>
              <Grid gutter="md">
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
                                this.props.experimentDetails
                                  ? this.props.experimentDetails.experimentItem.baseline.name
                                  : '',
                                this.props.experimentDetails ? this.props.experimentDetails.experimentItem.kind : ''
                              )}
                            />
                            <DataListItemCells
                              dataListCells={this.percentageInfo(
                                'Baseline',
                                this.props.experimentDetails
                                  ? this.props.experimentDetails.experimentItem.baseline.weight
                                  : 0
                              )}
                            />
                          </DataListItemRow>
                        </DataListItem>
                        {this.props.experimentDetails?.experimentItem.candidates.map(can => {
                          let kind = this.props.experimentDetails?.experimentItem.kind
                            ? this.props.experimentDetails?.experimentItem.kind
                            : 'Deployment';
                          return (
                            <DataListItem aria-labelledby="Candidate">
                              <DataListItemRow>
                                <DataListItemCells dataListCells={this.baselineInfo('Candidate', can.name, kind)} />
                                <DataListItemCells dataListCells={this.percentageInfo('Candidate', can.weight)} />
                              </DataListItemRow>
                            </DataListItem>
                          );
                        })}
                        {hasHosts ? (
                          <DataListItem aria-labelledby="Gateway">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={this.gatewayInfo(
                                  'H',

                                  this.props.namespace,
                                  this.props.experimentDetails.networking
                                    ? this.props.experimentDetails.networking.hosts[0].gateway
                                    : ''
                                )}
                              />
                              <DataListItemCells
                                dataListCells={
                                  <DataListCell key="gateway">
                                    <Text>Name</Text>
                                    <Text component={TextVariants.h3}>
                                      {this.props.experimentDetails.networking
                                        ? this.props.experimentDetails.networking.hosts[0].name
                                        : ''}
                                    </Text>
                                  </DataListCell>
                                }
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
                        <StackItem id={'Winner'}>
                          {this.props.experimentDetails.experimentItem.endTime !== '' ? (
                            <Grid>
                              <GridItem span={12}>
                                <StackItem>
                                  {this.props.experimentDetails.experimentItem.winner.winning_version_found ? (
                                    <>
                                      <Text component={TextVariants.h3}> Winner Found: {winnerInfo}</Text>
                                      {this.props.experimentDetails.experimentItem.winner.name}
                                      <Tooltip
                                        key={'winnerTooltip'}
                                        aria-label={'Winner Tooltip'}
                                        position={PopoverPosition.auto}
                                        className={'health_indicator'}
                                        content={
                                          <>
                                            {'Winning version identified by iter8 analytics'}
                                            {additionInfo}
                                          </>
                                        }
                                      >
                                        <KialiIcon.Info className={infoStyle} />
                                      </Tooltip>
                                    </>
                                  ) : (
                                    <Text component={TextVariants.h3}> Winner not Found </Text>
                                  )}
                                </StackItem>
                              </GridItem>
                            </Grid>
                          ) : (
                            <Grid>
                              <GridItem span={6}>
                                <StackItem>
                                  <Text component={TextVariants.h3}>
                                    {' '}
                                    {this.props.experimentDetails.experimentItem.endTime === ''
                                      ? 'Current Best Version'
                                      : 'Winner Version'}{' '}
                                  </Text>
                                  {this.props.experimentDetails.experimentItem.winner.name}
                                </StackItem>
                              </GridItem>
                              <GridItem span={6}>
                                <StackItem>
                                  <Text component={TextVariants.h3}> Probability of Winning: </Text>
                                  {
                                    this.props.experimentDetails.experimentItem.winner
                                      .probability_of_winning_for_best_version
                                  }
                                </StackItem>
                              </GridItem>
                            </Grid>
                          )}
                        </StackItem>
                        <StackItem>
                          <Grid>
                            <GridItem span={4}>
                              <StackItem id={'started_at'}>
                                <Text component={TextVariants.h3}> Created at </Text>
                                <LocalTime
                                  time={
                                    this.props.experimentDetails && this.props.experimentDetails.experimentItem.initTime
                                      ? this.props.experimentDetails.experimentItem.initTime
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
                                    this.props.experimentDetails &&
                                    this.props.experimentDetails.experimentItem.startTime
                                      ? this.props.experimentDetails.experimentItem.startTime
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
                                    this.props.experimentDetails && this.props.experimentDetails.experimentItem.endTime
                                      ? this.props.experimentDetails.experimentItem.endTime
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
            </GridItem>
            <GridItem span={12}>
              <Tabs isFilled={false} activeKey={0}>
                <Tab title={'Traffic Control'} eventKey={0} style={{ backgroundColor: PfColors.White }}>
                  <ErrorBoundaryWithMessage message={'Something went wrong'}>
                    <TrafficControlInfo trafficControl={this.props.experimentDetails.trafficControl} />
                  </ErrorBoundaryWithMessage>
                </Tab>
              </Tabs>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
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
    let candidateVersions: string[];
    candidateVersions = [];
    this.props.experimentDetails?.experimentItem.candidates.map(can => {
      candidateVersions.push(can.version);
    });
    if (this.props.experimentDetails !== undefined) {
      const params = `=${this.props.experimentDetails.experimentItem.baseline.version},${candidateVersions.join()}`;
      history.push(graphUrl + encodeURIComponent(params));
    } else {
      history.push(graphUrl);
    }
  };
}

export default ExperimentInfoDescription;
