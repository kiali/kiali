import * as React from 'react';
import { Workload } from '../../../types/Workload';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { WorkloadHealth } from '../../../types/Health';
import Labels from '../../../components/Label/Labels';
import {
  Card,
  CardBody,
  Grid,
  GridItem,
  PopoverPosition,
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';
import { TextOrLink } from 'components/TextOrLink';
import { renderRuntimeLogo, renderAPILogo } from 'components/Logo/Logos';

type WorkloadDescriptionProps = {
  workload: Workload;
  namespace: string;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};

type WorkloadDescriptionState = {};

class WorkloadDescription extends React.Component<WorkloadDescriptionProps, WorkloadDescriptionState> {
  constructor(props: WorkloadDescriptionProps) {
    super(props);
    this.state = {};
  }

  render() {
    const workload = this.props.workload;
    const isTemplateLabels =
      workload &&
      ['Deployment', 'ReplicaSet', 'ReplicationController', 'DeploymentConfig', 'StatefulSet'].indexOf(workload.type) >=
        0;
    const runtimes = workload.runtimes.map(r => r.name).filter(name => name !== '');
    return workload ? (
      <Grid gutter="md">
        <GridItem span={6}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Workload Overview{' '}
              </Title>
              <Stack>
                <StackItem id="labels">
                  <Text component={TextVariants.h3}> {isTemplateLabels ? 'Template Labels' : 'Labels'} </Text>
                  <Labels labels={workload.labels || {}} />
                </StackItem>
                <StackItem id="type">
                  <Text component={TextVariants.h3}> Type </Text>
                  {workload.type ? workload.type : 'N/A'}
                </StackItem>
                <StackItem id="created-at">
                  <Text component={TextVariants.h3}> Created at </Text>
                  <LocalTime time={workload.createdAt} />
                </StackItem>
                <StackItem id="resource-version">
                  <Text component={TextVariants.h3}> Resource Version </Text>
                  {workload.resourceVersion}
                </StackItem>
                {workload.additionalDetails.map((additionalItem, idx) => {
                  return (
                    <StackItem key={'additional-details-' + idx} id={'additional-details-' + idx}>
                      <Text component={TextVariants.h3}> {additionalItem.title} </Text>
                      {additionalItem.icon && renderAPILogo(additionalItem.icon, undefined, idx)}
                      <TextOrLink text={additionalItem.value} urlTruncate={64} />
                    </StackItem>
                  );
                })}
                {runtimes.length > 0 && (
                  <StackItem id="runtimes">
                    <Text component={TextVariants.h3}> Runtimes</Text>
                    {runtimes
                      .map((rt, idx) => renderRuntimeLogo(rt, idx))
                      .reduce(
                        (list: JSX.Element[], elem) =>
                          list.length > 0 ? [...list, <span key="sep"> | </span>, elem] : [elem],
                        []
                      )}
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={6}>
          <Card style={{ height: '100%' }}>
            <CardBody>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Health Overview{' '}
              </Title>
              <Stack>
                <StackItem id="health" className={'stack_service_details'}>
                  <Text component={TextVariants.h3}> Overall Health</Text>
                  <HealthIndicator
                    id={workload.name}
                    health={this.props.health}
                    mode={DisplayMode.LARGE}
                    tooltipPlacement={PopoverPosition.left}
                  />
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    ) : (
      'Loading'
    );
  }
}

export default WorkloadDescription;
