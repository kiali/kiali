import * as React from 'react';
import { Iter8Info } from '../../../../types/Iter8';
import { style } from 'typestyle';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import {
  ActionGroup,
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextInput
} from '@patternfly/react-core';
import history from '../../../../app/History';
import { RenderContent } from '../../../../components/Nav/Page';
import Namespace from '../../../../types/Namespace';
import ExperimentCriteriaForm from './ExperimentCriteriaForm';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import { KialiAppState } from '../../../../store/Store';
import { activeNamespacesSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';

interface Props {
  activeNamespaces: Namespace[];
}

interface State {
  iter8Info: Iter8Info;
  experiment: ExperimentSpec;
  namespaces: string[];
  services: string[];
  workloads: string[];
}

interface ExperimentSpec {
  name: string;
  namespace: string;
  service: string;
  apiversion: string;
  baseline: string;
  candidate: string;
  // canaryVersion: string;
  trafficControl: TrafficControl;
  criterias: Criteria[];
}

interface TrafficControl {
  algorithm: string;
  interval: string;
  maxIterations: number;
  maxTrafficPercentage: number;
  trafficStepSize: number;
}

export interface Criteria {
  metric: string;
  toleranceType: string;
  tolerance: number;
  sampleSize: number;
  stopOnFailure: boolean;
}

// Style constants
const containerPadding = style({ padding: '20px 20px 20px 20px' });

const algorithms = ['check_and_increment', 'epsilon_greedy'];

class ExperimentCreatePage extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);

    this.state = {
      iter8Info: {
        enabled: false
      },
      experiment: {
        name: '',
        namespace: 'default',
        apiversion: 'v1',
        service: '',
        baseline: '',
        candidate: '',
        trafficControl: {
          algorithm: 'check_and_increment',
          interval: '30s',
          maxIterations: 100,
          maxTrafficPercentage: 50,
          trafficStepSize: 2
        },
        criterias: []
      },
      namespaces: [],
      services: [],
      workloads: []
    };
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  fetchServices = () => {
    if (this.props.activeNamespaces.length === 1) {
      const ns = this.props.activeNamespaces[0];
      if (!this.promises.has('servicesByNamespace')) {
        this.promises
          .register('servicesByNamespace', API.getServices(ns.name))
          .then(response => {
            const services: string[] = response.data.services.map(svc => svc.name);
            if (services.length > 0) {
              this.promises
                .register('firstServiceDetails', API.getServiceDetail(ns.name, services[0], false))
                .then(responseDetail => {
                  let workloads: string[] = [];
                  if (responseDetail.workloads) {
                    workloads = responseDetail.workloads.map(w => w.name);
                  }
                  this.setState(prevState => {
                    prevState.experiment.service = services[0];
                    if (workloads.length > 0) {
                      prevState.experiment.baseline = workloads[0];
                      prevState.experiment.candidate = workloads[0];
                    } else {
                      prevState.experiment.baseline = '';
                      prevState.experiment.candidate = '';
                    }
                    return {
                      services: services,
                      workloads: workloads,
                      experiment: prevState.experiment
                    };
                  });
                  this.promises.cancel('firstServiceDetails');
                })
                .catch(svcDetailError => {
                  if (!svcDetailError.isCanceled) {
                    AlertUtils.addError('Could not fetch Service Detail.', svcDetailError);
                  }
                });
            }
            // Clean promise from register
            this.promises.cancel('servicesByNamespace');
          })
          .catch(svcError => {
            if (!svcError.isCanceled) {
              AlertUtils.addError('Could not fetch Services list.', svcError);
            }
          });
      }
    }
  };

  fetchWorkloads = (namespace, serviceName: string) => {
    this.promises
      .register('serviceDetails', API.getServiceDetail(namespace, serviceName, false))
      .then(responseDetail => {
        let workloads: string[] = [];
        if (responseDetail.workloads) {
          workloads = responseDetail.workloads.map(w => w.name);
        }
        this.setState(prevState => {
          if (workloads.length > 0) {
            prevState.experiment.baseline = workloads[0];
            prevState.experiment.candidate = workloads[0];
          } else {
            prevState.experiment.baseline = '';
            prevState.experiment.candidate = '';
          }
          return {
            workloads: workloads,
            experiment: prevState.experiment
          };
        });
      })
      .catch(svcDetailError => {
        if (!svcDetailError.isCanceled) {
          AlertUtils.addError('Could not fetch Service Detail.', svcDetailError);
        }
      });
  };

  componentDidMount() {
    this.fetchServices();
  }

  componentDidUpdate(prevProps: Props, _prevState: State) {
    if (
      this.props.activeNamespaces.length === 1 &&
      (prevProps.activeNamespaces.length !== 1 ||
        (prevProps.activeNamespaces.length === 1 && this.props.activeNamespaces[0] !== prevProps.activeNamespaces[0]) ||
        this.state.services.length === 0)
    ) {
      this.fetchServices();
    }
  }

  // Invoke the history object to update and URL and start a routing
  goExperimentsPage = () => {
    history.push('/extensions/iter8');
  };

  // Updates state with modifications of the new/editing handler
  changeExperiment = (field: string, value: string) => {
    this.setState(prevState => {
      const newExperiment = prevState.experiment;
      switch (field) {
        case 'name':
          newExperiment.name = value.trim();
          break;
        case 'namespace':
          newExperiment.namespace = value.trim();
          break;
        case 'service':
          newExperiment.service = value.trim();
          break;
        case 'algorithm':
          newExperiment.trafficControl.algorithm = value.trim();
          break;
        case 'baseline':
          newExperiment.baseline = value.trim();
          break;
        case 'candidate':
          newExperiment.candidate = value.trim();
          break;
        case 'kubernets':
          newExperiment.apiversion = 'v1';
          break;
        case 'knative':
          newExperiment.apiversion = 'serving.knative.dev/v1alpha1';
          break;
        case 'metricName':
          newExperiment.criterias[0].metric = value.trim();
          break;
        case 'toleranceType':
          newExperiment.criterias[0].toleranceType = value.trim();
          break;
        case 'interval':
          newExperiment.trafficControl.interval = value.trim();
          break;
        default:
      }
      return {
        experiment: newExperiment
      };
    });
  };

  // Updates state with modifications of the new/editing handler
  changeExperimentNumber = (field: string, value: number) => {
    this.setState(prevState => {
      const newExperiment = prevState.experiment;
      switch (field) {
        case 'maxIteration':
          newExperiment.trafficControl.maxIterations = value;
          break;
        case 'maxTrafficPercentage':
          newExperiment.trafficControl.maxTrafficPercentage = value;
          break;
        case 'trafficStepSize':
          newExperiment.trafficControl.trafficStepSize = value;
          break;
        case 'sampleSize':
          newExperiment.criterias[0].sampleSize = value;
          break;
        case 'tolerance':
          newExperiment.criterias[0].tolerance = value;
          break;
        default:
      }
      return {
        experiment: newExperiment
      };
    });
  };

  // It invokes backend to create  a new experiment
  createExperiment = () => {
    if (this.props.activeNamespaces.length === 1) {
      const ns = this.props.activeNamespaces[0];
      this.promises
        .register('Create Iter8 Experiment', API.createExperiment(ns.name, JSON.stringify(this.state.experiment)))
        .then(_ => this.goExperimentsPage())
        .catch(error => AlertUtils.addError('Could not create Experiment.', error));
    }
  };

  isMainFormValid = (): boolean => {
    return (
      this.state.experiment.name !== '' &&
      this.state.experiment.service !== '' &&
      this.props.activeNamespaces.length === 1 &&
      this.state.experiment.baseline !== '' &&
      this.state.experiment.candidate !== ''
    );
  };

  isTCFormValid = (): boolean => {
    return (
      this.state.experiment.trafficControl.interval !== '' && this.state.experiment.trafficControl.maxIterations > 0
    );
  };

  isSCFormValid = (): boolean => {
    return this.state.experiment.criterias.length > 0;
  };

  render() {
    const isNamespacesValid = this.props.activeNamespaces.length === 1;
    const isFormValid = this.isMainFormValid() && this.isTCFormValid() && this.isSCFormValid();
    // @ts-ignore
    return (
      <>
        <RenderContent>
          <div className={containerPadding}>
            <Form isHorizontal={true}>
              <FormGroup
                fieldId="name"
                label="Experiment Name"
                isRequired={true}
                isValid={this.state.experiment.name !== ''}
                helperTextInvalid="Name cannot be empty"
              >
                <TextInput
                  id="name"
                  value={this.state.experiment.name}
                  placeholder="Experiment Name"
                  onChange={value => this.changeExperiment('name', value)}
                />
              </FormGroup>

              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup
                    fieldId="service"
                    label="Target Service"
                    isRequired={true}
                    isValid={this.state.experiment.service !== ''}
                    helperText="Target Service specifies the reference to experiment targets (i.e. reviews)"
                    helperTextInvalid="Target Service cannot be empty"
                  >
                    <FormSelect
                      id="service"
                      value={this.state.experiment.service}
                      placeholder="Target Service"
                      onChange={value => {
                        this.changeExperiment('service', value);
                        if (this.props.activeNamespaces.length === 1) {
                          const ns = this.props.activeNamespaces[0].name;
                          this.fetchWorkloads(ns, value);
                        }
                      }}
                    >
                      {this.state.services.map((svc, index) => (
                        <FormSelectOption label={svc} key={'service' + index} value={svc} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    label="Namespaces"
                    isRequired={true}
                    fieldId="namespaces"
                    helperText={'Select namespace where this configuration will be applied'}
                    helperTextInvalid={'Only one namespace should be selected'}
                    isValid={isNamespacesValid}
                  >
                    <TextInput
                      value={this.props.activeNamespaces.map(n => n.name).join(',')}
                      isRequired={true}
                      type="text"
                      id="namespaces"
                      aria-describedby="namespaces"
                      name="namespaces"
                      isDisabled={true}
                      isValid={isNamespacesValid}
                    />
                  </FormGroup>
                </GridItem>
              </Grid>
              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup
                    fieldId="baseline"
                    label="Baseline"
                    isRequired={true}
                    isValid={this.state.experiment.baseline !== ''}
                    helperText="The baseline deployment of the target service (i.e. reviews-v1)"
                    helperTextInvalid="Baseline deployment cannot be empty"
                  >
                    <FormSelect
                      id="baseline"
                      value={this.state.experiment.baseline}
                      placeholder="Baseline Deployment"
                      onChange={value => this.changeExperiment('baseline', value)}
                    >
                      {this.state.workloads.map((wk, index) => (
                        <FormSelectOption label={wk} key={'workloadBaseline' + index} value={wk} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    fieldId="candidate"
                    label="Candidate"
                    isRequired={true}
                    isValid={this.state.experiment.candidate !== ''}
                    helperText="The candidate deployment of the target service (i.e. reviews-v2)"
                    helperTextInvalid="Candidate deployment cannot be empty"
                  >
                    <FormSelect
                      id="candidate"
                      value={this.state.experiment.candidate}
                      placeholder="Candidate Deployment"
                      onChange={value => this.changeExperiment('candidate', value)}
                    >
                      {this.state.workloads.map((wk, index) => (
                        <FormSelectOption label={wk} key={'workloadCandidate' + index} value={wk} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </GridItem>
              </Grid>
              <hr />
              <h1 className="pf-c-title pf-m-xl">Traffic Control</h1>
              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup
                    fieldId="interval"
                    label="Interval"
                    isValid={this.state.experiment.trafficControl.interval !== ''}
                    helperText="Frequency with which the controller calls the analytics service"
                    helperTextInvalid="Interval cannot be empty"
                  >
                    <TextInput
                      id="interval"
                      value={this.state.experiment.trafficControl.interval}
                      placeholder="Time interval i.e. 30s"
                      onChange={value => this.changeExperiment('interval', value)}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    fieldId="maxIteration"
                    label="Maximum Iteration"
                    isValid={this.state.experiment.trafficControl.maxIterations > 0}
                    helperText="Maximum number of iterations for this experiment"
                    helperTextInvalid="Maximun Iteration cannot be empty"
                  >
                    <TextInput
                      id="maxIteration"
                      type="number"
                      value={this.state.experiment.trafficControl.maxIterations}
                      placeholder="Maximum Iteration"
                      onChange={value => this.changeExperimentNumber('maxIteration', Number(value))}
                    />
                  </FormGroup>
                </GridItem>
              </Grid>
              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup
                    fieldId="maxTrafficPercentage"
                    label="Maximum Traffic Percentage"
                    isValid={
                      this.state.experiment.trafficControl.maxTrafficPercentage >= 0 &&
                      this.state.experiment.trafficControl.maxTrafficPercentage <= 100
                    }
                    helperText="The maximum traffic percentage to send to the candidate during an experiment"
                    helperTextInvalid="Maximum Traffic Percentage must be between 0 and 100"
                  >
                    <TextInput
                      id="maxTrafficPercentage"
                      type="number"
                      value={this.state.experiment.trafficControl.maxTrafficPercentage}
                      placeholder="Service Name"
                      onChange={value => this.changeExperimentNumber('maxTrafficPercentage', parseFloat(value))}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    fieldId="trafficStepSize"
                    label="Traffic Step Size"
                    isValid={this.state.experiment.trafficControl.trafficStepSize > 0}
                    helperText="The maximum traffic increment per iteration"
                    helperTextInvalid="Traffic Step Size must be > 0"
                  >
                    <TextInput
                      id="trafficStepSize"
                      value={this.state.experiment.trafficControl.trafficStepSize}
                      placeholder="Traffic Step Size"
                      onChange={value => this.changeExperimentNumber('trafficStepSize', parseFloat(value))}
                    />
                  </FormGroup>
                </GridItem>
              </Grid>
              <FormGroup
                fieldId="algorithm"
                label="Algorithm"
                helperText="Strategy used to analyze the candidate and shift the traffic"
              >
                <FormSelect
                  value={this.state.experiment.trafficControl.algorithm}
                  id="algorithm"
                  name="Algorithm"
                  onChange={value => this.changeExperiment('algorithm', value)}
                >
                  {algorithms.map((option, index) => (
                    <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
                  ))}
                </FormSelect>
              </FormGroup>
              <hr />
              <h1 className="pf-c-title pf-m-xl">Success Criteria</h1>
              <ExperimentCriteriaForm
                criterias={this.state.experiment.criterias}
                onAdd={newCriteria => {
                  this.setState(prevState => {
                    prevState.experiment.criterias.push(newCriteria);
                    return {
                      iter8Info: prevState.iter8Info,
                      experiment: {
                        name: prevState.experiment.name,
                        namespace: prevState.experiment.namespace,
                        service: prevState.experiment.service,
                        apiversion: prevState.experiment.apiversion,
                        baseline: prevState.experiment.baseline,
                        candidate: prevState.experiment.candidate,
                        trafficControl: prevState.experiment.trafficControl,
                        criterias: prevState.experiment.criterias
                      }
                    };
                  });
                }}
                onRemove={index => {
                  this.setState(prevState => {
                    prevState.experiment.criterias.splice(index, 1);
                    return {
                      iter8Info: prevState.iter8Info,
                      experiment: {
                        name: prevState.experiment.name,
                        namespace: prevState.experiment.namespace,
                        service: prevState.experiment.service,
                        apiversion: prevState.experiment.apiversion,
                        baseline: prevState.experiment.baseline,
                        candidate: prevState.experiment.candidate,
                        trafficControl: prevState.experiment.trafficControl,
                        criterias: prevState.experiment.criterias
                      }
                    };
                  });
                }}
              />
              <ActionGroup>
                <span style={{ float: 'left', paddingTop: '10px', paddingBottom: '10px' }}>
                  <span style={{ paddingRight: '5px' }}>
                    <Button
                      variant={ButtonVariant.primary}
                      isDisabled={!isFormValid}
                      onClick={() => this.createExperiment()}
                    >
                      Create
                    </Button>
                  </span>
                  <span style={{ paddingRight: '5px' }}>
                    <Button
                      variant={ButtonVariant.secondary}
                      onClick={() => {
                        this.goExperimentsPage();
                      }}
                    >
                      Cancel
                    </Button>
                  </span>
                </span>
              </ActionGroup>
            </Form>
          </div>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const ExperimentCreatePageContainer = connect(
  mapStateToProps,
  null
)(ExperimentCreatePage);

export default ExperimentCreatePageContainer;
