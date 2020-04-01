import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { RenderHeader } from '../../../../components/Nav/Page';
import {
  Breadcrumb,
  BreadcrumbItem,
  Card,
  CardBody,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { Iter8ExpDetailsInfo } from '../../../../types/Iter8';
import RefreshButtonContainer from '../../../../components/Refresh/RefreshButton';
import Iter8Dropdown from './Iter8Dropdown';
import history from '../../../../app/History';

interface Props {
  namespace: string;
  name: string;
}

interface State {
  experiment?: Iter8ExpDetailsInfo;
  canDelete: boolean;
}

const containerPadding = style({ padding: '20px 20px 20px 20px' });
const tabsPadding = style({ height: '40px', padding: '0px ', backgroundColor: 'white' });

class ExperimentDetailsPage extends React.Component<RouteComponentProps<Props>, State> {
  constructor(props: RouteComponentProps<Props>) {
    super(props);
    this.state = {
      experiment: undefined,
      canDelete: false
    };
  }

  fetchExperiment = () => {
    const namespace = this.props.match.params.namespace;
    const name = this.props.match.params.name;
    API.getIter8Info()
      .then(result => {
        const iter8Info = result.data;
        if (iter8Info.enabled) {
          API.getExperiment(namespace, name)
            .then(result => {
              this.setState({
                experiment: result.data,
                canDelete: result.data.permissions.delete
              });
            })
            .catch(error => {
              AlertUtils.addError('Could not fetch Iter8 Experiment', error);
            });
        } else {
          AlertUtils.addError('Kiali has Iter8 extension enabled but it is not detected in the cluster');
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Iter8 Info.', error);
      });
  };

  componentDidMount() {
    this.fetchExperiment();
  }

  // Extensions breadcrumb,
  // It is a simplified view of BreadcrumbView with fixed rendering
  breadcrumb = () => {
    return (
      <div className="breadcrumb">
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to={`/extensions/iter8`}>Iter8 Experiments</Link>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <Link to={`/extensions/iter8?namespaces=${this.props.match.params.namespace}`}>
              Namespace: {this.props.match.params.namespace}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive={true}>{this.props.match.params.name}</BreadcrumbItem>
        </Breadcrumb>
      </div>
    );
  };

  renderOverview = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Target Service{' '}
          </Title>
          <Stack>
            <StackItem id={'targetService'}>
              <Text component={TextVariants.h3}> Service </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.targetService : ''}
            </StackItem>
            <StackItem id={'baseline'}>
              <Text component={TextVariants.h3}> Baseline / Traffic Split</Text>
              {this.state.experiment
                ? this.state.experiment.experimentItem.baseline +
                  ' / ' +
                  this.state.experiment.experimentItem.baselinePercentage +
                  ' % '
                : ''}
            </StackItem>
            <StackItem id={'candidate'}>
              <Text component={TextVariants.h3}> Candidate / Traffic Split</Text>
              {this.state.experiment
                ? this.state.experiment.experimentItem.candidate +
                  ' / ' +
                  this.state.experiment.experimentItem.candidatePercentage +
                  ' % '
                : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    );
  };

  renderTrafficControl = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Traffic Control{' '}
          </Title>
          <Stack>
            <StackItem id={'strategy'}>
              <Text component={TextVariants.h3}> Strategy </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.algorithm : ''}
            </StackItem>
            <StackItem id={'maxIterations'}>
              <Text component={TextVariants.h3}> Max Iterations </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.maxIterations : ''}
            </StackItem>
            <StackItem id={'maxTrafficPercentage'}>
              <Text component={TextVariants.h3}> Max Traffic Percentage </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.maxTrafficPercentage : ''}
            </StackItem>
            <StackItem id={'trafficStepSide'}>
              <Text component={TextVariants.h3}> Traffic Step Side </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.trafficStepSide : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    );
  };

  renderStatus = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Status{' '}
          </Title>
          <Stack>
            <StackItem id={'phase'}>
              <Text component={TextVariants.h3}> Phase </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.phase : ''}
            </StackItem>
            <StackItem id={'status'}>
              <Text component={TextVariants.h3}> Status </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.status : ''}
            </StackItem>
            <StackItem id={'started'}>
              <Text component={TextVariants.h3}> Started </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.startedAt : ''}
            </StackItem>
            <StackItem id={'ended'}>
              <Text component={TextVariants.h3}> Ended </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.endedAt : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    );
  };

  backToList = () => {
    // Back to list page
    history.push(`/extensions/iter8?namespaces=${this.props.match.params.namespace}`);
  };

  doRefresh = () => {
    this.fetchExperiment();
  };

  doDelete = () => {
    API.deleteExperiment(this.props.match.params.namespace, this.props.match.params.name)
      .then(() => this.backToList())
      .catch(error => {
        AlertUtils.addError('Could not delete Iter8 Experiment.', error);
      });
  };

  renderRightToolbar = () => {
    return (
      <span style={{ position: 'absolute', right: '50px', zIndex: 1 }}>
        <RefreshButtonContainer handleRefresh={this.doRefresh} />
        <Iter8Dropdown
          experimentName={this.props.match.params.name}
          canDelete={this.state.canDelete}
          onDelete={this.doDelete}
        />
      </span>
    );
  };

  render() {
    return (
      <>
        <RenderHeader>
          {this.breadcrumb()}
          <Text component={TextVariants.h1}>{this.props.match.params.name}</Text>
          {this.renderRightToolbar()}
        </RenderHeader>
        <div className={tabsPadding} />
        <div className={containerPadding}>
          <Grid gutter={'md'}>
            <GridItem span={4}>{this.renderOverview()}</GridItem>
            <GridItem span={4}>{this.renderTrafficControl()}</GridItem>
            <GridItem span={4}>{this.renderStatus()}</GridItem>
          </Grid>
        </div>
      </>
    );
  }
}

export default ExperimentDetailsPage;
