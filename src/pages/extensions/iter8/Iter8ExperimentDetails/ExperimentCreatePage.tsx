import * as React from 'react';
import { Iter8Info } from '../../../../types/Iter8';
import { style } from 'typestyle';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import {
  ActionGroup,
  Button,
  ButtonVariant,
  Expandable,
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
  serviceName: string;
  namespace: string;
  onChange: (experiment: ExperimentSpec) => void;
}

interface State {
  iter8Info: Iter8Info;
  experiment: ExperimentSpec;
  namespaces: string[];
  services: string[];
  workloads: string[];
  metricNames: string[];
  showAdvanced: boolean;
  showTrafficStep: boolean;
  reloadService: boolean;
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
const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const algorithms = [
  'check_and_increment',
  'epsilon_greedy',
  'increment_without_check',
  'posterior_bayesian_routing',
  'optimistic_bayesian_routing'
];

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
        namespace: this.props.namespace,
        apiversion: 'v1',
        service: this.props.serviceName,
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
      workloads: [],
      metricNames: [],
      showAdvanced: false,
      showTrafficStep: true,
      reloadService: false
    };
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  fetchNamespaces = () => {
    this.promises.register('namespaces', API.getNamespaces()).then(namespacesResponse => {
      let allNamespaces = namespacesResponse.data.map(nsInfo => {
        return nsInfo.name;
      });
      this.setState(prevState => {
        const newExperiment = prevState.experiment;
        newExperiment.baseline = '';
        newExperiment.candidate = '';
        if (this.props.activeNamespaces.length === 1 && prevState.experiment.namespace === '') {
          newExperiment.namespace = this.props.activeNamespaces[0].name;
        } else {
          newExperiment.namespace = allNamespaces[0];
        }

        return {
          experiment: newExperiment,
          namespaces: allNamespaces,
          reloadService: !history.location.pathname.endsWith('/new')
        };
      });
    });
  };

  fetchMetrics = () => {
    this.promises
      .register('iter8Metrics', API.getIter8Metrics())
      .then(mresponse => {
        let metricsNames: string[] = ['-- select one ---'];
        metricsNames = metricsNames.concat(mresponse.data);
        this.setState(prevState => {
          return {
            iter8Info: prevState.iter8Info,
            experiment: prevState.experiment,
            reloadService: prevState.reloadService,
            metricNames: metricsNames
          };
        });
      })
      .catch(metricsError => {
        if (!metricsError.isCanceled) {
          AlertUtils.addError('Could not fetch Iter8 Metric  Detail.', metricsError);
        }
      });
  };

  fetchServices = (selectedNS: string) => {
    let _namespace = '';
    if (selectedNS !== '') {
      _namespace = selectedNS;
    } else if (this.state.experiment.namespace !== '') {
      _namespace = this.state.experiment.namespace;
    } else if (this.props.activeNamespaces.length > 0) {
      _namespace = this.props.activeNamespaces[0].name;
    }

    if (_namespace.length > 0) {
      // const ns = this.props.activeNamespaces[0];
      if (!this.promises.has('servicesByNamespace')) {
        this.promises
          .register('servicesByNamespace', API.getServices(_namespace))
          .then(response => {
            const services: string[] = response.data.services.map(svc => svc.name);
            if (services.length > 0) {
              this.promises
                .register('firstServiceDetails', API.getServiceDetail(_namespace, services[0], false))
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
                      experiment: prevState.experiment,
                      reloadService: false
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
    if (this.state.namespaces.length === 0 && this.props.namespace === undefined) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespace: Namespace[] = namespacesResponse.data;
          let allNamespaces = namespace.map(nsInfo => {
            return nsInfo.name;
          });
          this.setState(prevState => {
            const newExperiment = prevState.experiment;
            if (this.props.activeNamespaces.length === 1) {
              newExperiment.namespace = this.props.activeNamespaces[0].name;
            } else {
              newExperiment.namespace = allNamespaces[0];
            }
            return {
              experiment: newExperiment,
              namespaces: allNamespaces,
              reloadService: false
            };
          });
        })
        .then(() => {
          this.fetchServices(this.state.experiment.namespace);
        })
        .then(() => {
          this.fetchMetrics();
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            AlertUtils.addError('Could not fetch namespace list', namespacesError);
          }
        });
    } else if (this.props.namespace !== undefined && this.props.serviceName !== undefined) {
      this.fetchWorkloads(this.props.namespace, this.props.serviceName);
      this.fetchMetrics();
    }
  }

  componentDidUpdate(_: Props, _prevState: State) {
    if (this.state.reloadService) {
      this.fetchServices('');
    }
  }

  onExperimentChange = (newexperiment: ExperimentSpec) => {
    this.setState({
      experiment: newexperiment
    });
  };
  // Invoke the history object to update and URL and start a routing
  goExperimentsPage = () => {
    history.push('/extensions/iter8');
  };

  // It invokes backend to create  a new experiment
  createExperiment = () => {
    // if (this.props.activeNamespaces.length === 1) {
    const nsName = this.state.experiment.namespace;
    this.promises
      .register('Create Iter8 Experiment', API.createExperiment(nsName, JSON.stringify(this.state.experiment)))
      .then(_ => this.goExperimentsPage())
      .catch(error => AlertUtils.addError('Could not create Experiment.', error));
  };

  // Updates state with modifications of the new/editing handler
  changeExperiment = (field: string, value: string) => {
    this.setState(
      prevState => {
        let reloadService = prevState.reloadService;
        const newExperiment = prevState.experiment;
        switch (field) {
          case 'name':
            newExperiment.name = value.trim();
            break;
          case 'namespace':
            newExperiment.namespace = value.trim();
            reloadService = true;
            break;
          case 'service':
            newExperiment.service = value.trim();
            break;
          case 'algorithm':
            if (value.trim() === 'check_and_increment') {
              this.setState({
                showTrafficStep: true
              });
            } else {
              this.setState({
                showTrafficStep: false
              });
            }
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
          experiment: newExperiment,
          reloadService: reloadService
        };
      },
      () => {
        history.location.pathname.endsWith('/new')
          ? this.onExperimentChange(this.state.experiment)
          : this.props.onChange(this.state.experiment);
      }
    );
  };

  // Updates state with modifications of the new/editing handler
  changeExperimentNumber = (field: string, value: number) => {
    this.setState(
      prevState => {
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
          case 'tolerance':
            newExperiment.criterias[0].tolerance = value;
            break;
          default:
        }
        return {
          experiment: newExperiment
        };
      },
      () => {
        history.location.pathname.endsWith('/new')
          ? this.onExperimentChange(this.state.experiment)
          : this.props.onChange(this.state.experiment);
      }
    );
  };

  isMainFormValid = (): boolean => {
    return (
      this.state.experiment.name !== '' &&
      this.state.experiment.name.search(regex) === 0 &&
      this.state.experiment.service !== '' &&
      this.state.experiment.namespace !== '' &&
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
    return this.state.experiment.criterias.length !== 0;
  };

  render() {
    const isNamespacesValid = this.props.activeNamespaces.length === 1;
    const isFormValid = this.isMainFormValid() && this.isSCFormValid();
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
                isValid={this.state.experiment.name !== '' && this.state.experiment.name.search(regex) === 0}
                helperTextInvalid="Name cannot be empty and must be a DNS subdomain name as defined in RFC 1123."
              >
                <TextInput
                  id="name"
                  value={this.state.experiment.name}
                  placeholder="Experiment Name"
                  onChange={value => this.changeExperiment('name', value)}
                />
              </FormGroup>
              {history.location.pathname.endsWith('/new') ? (
                <Grid gutter="md">
                  <GridItem span={6}>
                    <FormGroup
                      label="Namespaces"
                      isRequired={true}
                      fieldId="namespaces"
                      helperText={'Select namespace where this configuration will be applied'}
                      isValid={isNamespacesValid}
                    >
                      <FormSelect
                        id="namespaces"
                        value={this.state.experiment.namespace}
                        placeholder="Namespace"
                        onChange={value => {
                          this.changeExperiment('namespace', value);
                          this.fetchServices(value);
                        }}
                      >
                        {this.state.namespaces.map((svc, index) => (
                          <FormSelectOption label={svc} key={'namespace' + index} value={svc} />
                        ))}
                      </FormSelect>
                    </FormGroup>
                  </GridItem>
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
                          const ns = this.state.experiment.namespace;
                          this.fetchWorkloads(ns, value);
                        }}
                      >
                        {this.state.services.map((svc, index) => (
                          <FormSelectOption label={svc} key={'service' + index} value={svc} />
                        ))}
                      </FormSelect>
                    </FormGroup>
                  </GridItem>
                </Grid>
              ) : (
                ''
              )}
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
              <h1 className="pf-c-title pf-m-xl">Assessment Criteria</h1>
              <ExperimentCriteriaForm
                criterias={this.state.experiment.criterias}
                metricNames={this.state.metricNames}
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

              <Expandable
                toggleText={(this.state.showAdvanced ? 'Hide' : 'Show') + ' Advanced Options'}
                isExpanded={this.state.showAdvanced}
                onToggle={() => {
                  this.setState({
                    showAdvanced: !this.state.showAdvanced
                  });
                }}
              >
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
                  </GridItem>
                  <GridItem span={6}>
                    <FormGroup
                      style={this.state.showTrafficStep ? {} : { display: 'none' }}
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
              </Expandable>
              {history.location.pathname.endsWith('/new') ? (
                <ActionGroup>
                  <span
                    style={{
                      float: 'left',
                      paddingTop: '10px',
                      paddingBottom: '10px',
                      width: '100%'
                    }}
                  >
                    <span style={{ float: 'right', paddingRight: '5px' }}>
                      <Button
                        variant={ButtonVariant.primary}
                        isDisabled={!isFormValid}
                        onClick={() => this.createExperiment()}
                      >
                        Create
                      </Button>
                    </span>
                    <span style={{ float: 'right', paddingRight: '5px' }}>
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
              ) : (
                ''
              )}
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
