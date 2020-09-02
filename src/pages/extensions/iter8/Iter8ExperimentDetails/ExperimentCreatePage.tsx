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
  Switch,
  TextInputBase as TextInput
} from '@patternfly/react-core';
import history from '../../../../app/History';
import { RenderContent } from '../../../../components/Nav/Page';
import Namespace from '../../../../types/Namespace';
import ExperimentCriteriaForm from './ExperimentCriteriaForm';
import ExperimentHostForm, { HostState, initHost } from './ExperimentHostForm';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import { KialiAppState } from '../../../../store/Store';
import { activeNamespacesSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import { PfColors } from '../../../../components/Pf/PfColors';

interface Props {
  serviceName: string;
  namespace: string;
  onChange: (valid: boolean, experiment: ExperimentSpec) => void;
  showAdvanced: boolean;
}

interface State {
  iter8Info: Iter8Info;
  experiment: ExperimentSpec;
  namespaces: string[];
  services: string[];
  workloads: string[];
  gateways: string[];
  hostsOfGateway: Host[];
  metricNames: string[];
  showAdvanced: boolean;
  showTrafficStep: boolean;
  reloadService: boolean;
  totalDuration: string;
  hostState: HostState;
  value: string;
  filename: string;
  addHostGateway: boolean;
  showTrafficControl: boolean;
}

interface ExperimentSpec {
  name: string;
  namespace: string;
  service: string;
  apiversion: string;
  baseline: string;
  candidate: string;
  experimentKind: string;
  trafficControl: TrafficControl;
  criterias: Criteria[];
  hosts: Host[];
}

interface TrafficControl {
  algorithm: string;
  interval: string;
  intervalInSecond: number;
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

export interface Host {
  name: string;
  gateway: string;
}

// Style constants
const containerPadding = style({ padding: '20px 20px 20px 20px' });
const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const formPadding = style({ padding: '30px 20px 30px 20px' });

const durationTimeStyle = style({
  paddingTop: 8,
  color: PfColors.Blue400
});
const algorithms = [
  'check_and_increment',
  'epsilon_greedy',
  'increment_without_check',
  'posterior_bayesian_routing',
  'optimistic_bayesian_routing'
];

const toggleTextFlat = ['More', 'Less'];
const toggleTextWizard = ['Show Advanced Options', 'Hide Advanced Options'];

const iter8oExpOptions = [
  { value: 'Deployment', label: 'WORKLOAD' },
  { value: 'Service', label: 'SERVICE' }
];

class ExperimentCreatePage extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);

    this.state = {
      iter8Info: {
        enabled: false,
        supportedVersion: false,
        analyticsImageVersion: '',
        controllerImageVersion: ''
      },
      experiment: {
        name: '',
        namespace: this.props.namespace,
        apiversion: 'v1',
        service: this.props.serviceName,
        baseline: '',
        candidate: '',
        experimentKind: 'Deployment',
        trafficControl: {
          algorithm: 'check_and_increment',
          interval: '30s',
          intervalInSecond: 30,
          maxIterations: 10,
          maxTrafficPercentage: 50,
          trafficStepSize: 10
        },
        criterias: [],
        hosts: []
      },
      namespaces: [],
      services: [],
      workloads: [],
      gateways: [],
      hostsOfGateway: [],
      metricNames: [],
      showAdvanced: history.location.pathname.endsWith('/new') ? true : this.props.showAdvanced,
      showTrafficStep: true,
      reloadService: false,
      totalDuration: '50 minutes',
      hostState: initHost(''),
      value: '',
      filename: '',
      addHostGateway: false,
      showTrafficControl: false
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
        newExperiment.namespace = allNamespaces[0];
        return {
          experiment: newExperiment,
          namespaces: allNamespaces,
          reloadService: !history.location.pathname.endsWith('/new')
        };
      });
    });
  };

  fetchIter8Info = () => {
    this.promises
      .register('iter8Metrics', API.getIter8Info())
      .then(result => {
        const iter8Info = result.data;
        this.setState(prevState => {
          return {
            iter8Info: iter8Info,
            experiment: prevState.experiment,
            reloadService: prevState.reloadService,
            metricNames: prevState.metricNames
          };
        });
      })
      .catch(infoerror => {
        if (!infoerror.isCanceled) {
          AlertUtils.addError('Could not fetch Iter8 Info Detail.', infoerror);
        }
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
    }

    if (_namespace.length > 0) {
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

  fetchGateways = (namespace: string) => {
    this.promises.register('gateways', API.getIstioConfig(namespace, ['gateways'], false, '', '')).then(response => {
      let gatewayhostpair: Host[] = [];
      let gateways: string[] = [];
      gateways.push('-- select gateway --');
      response.data.gateways.forEach(gt => {
        gt.spec.servers?.forEach(svc => {
          gateways.push(gt.metadata.name);
          svc.hosts.forEach(hs => {
            gatewayhostpair.push({
              name: hs,
              gateway: gt.metadata.name
            });
          });
        });
      });
      this.setState(prevState => {
        return {
          services: prevState.services,
          workloads: prevState.workloads,
          gateways: gateways,
          hostsOfGateway: gatewayhostpair,
          experiment: prevState.experiment,
          reloadService: false,
          hostState: initHost(gateways[0])
        };
      });
    });
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
            newExperiment.namespace = allNamespaces[0];
            return {
              experiment: newExperiment,
              namespaces: allNamespaces,
              reloadService: false
            };
          });
        })
        .then(() => {
          this.fetchIter8Info();
        })
        .then(() => {
          this.fetchServices(this.state.experiment.namespace);
        })
        .then(() => {
          this.fetchGateways(this.state.experiment.namespace);
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
      this.fetchGateways(this.props.namespace);
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

  onExperimentKindChange = (value, _) => {
    this.setState(prevState => {
      const newExperiment = prevState.experiment;
      newExperiment.experimentKind = value;
      return {
        experiment: newExperiment
      };
    });
  };

  // Invoke the history object to update and URL and start a routing
  goExperimentsPage = () => {
    history.push('/extensions/iter8');
  };

  // It invokes backend to create  a new experiment
  createExperiment = () => {
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
          : this.props.onChange(this.isMainFormValid(), this.state.experiment);
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
          case 'interval':
            newExperiment.trafficControl.intervalInSecond = value;
            newExperiment.trafficControl.interval = newExperiment.trafficControl.intervalInSecond + 's';
            break;
          default:
        }
        const totalSecond = newExperiment.trafficControl.maxIterations * newExperiment.trafficControl.intervalInSecond;
        const hours = Math.floor(totalSecond / 60 / 60);
        const minutes = Math.floor(totalSecond / 60) - hours * 60;
        return {
          experiment: newExperiment,
          totalDuration: hours + ' hours ' + minutes + ' minutes ' + (totalSecond % 60) + ' seconds'
        };
      },
      () => {
        history.location.pathname.endsWith('/new')
          ? this.onExperimentChange(this.state.experiment)
          : this.props.onChange(this.isMainFormValid(), this.state.experiment);
      }
    );
  };

  isMainFormValid = (): boolean => {
    return (
      this.state.experiment.name !== '' &&
      this.state.experiment.name.search(regex) === 0 &&
      ((this.state.experiment.experimentKind === 'Deployment' && this.state.experiment.service !== '') ||
        this.state.experiment.experimentKind === 'Service') &&
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

  renderGeneral() {
    return (
      <>
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
        <FormGroup label="Istio Resource" fieldId="istio-resource">
          <FormSelect
            value={this.state.experiment.experimentKind}
            onChange={this.onExperimentKindChange}
            id="istio-resource"
            name="istio-resource"
          >
            {iter8oExpOptions.map((option, index) => (
              <FormSelectOption key={index} value={option.value} label={option.label} />
            ))}
          </FormSelect>
        </FormGroup>

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

        <FormGroup
          fieldId="candidate"
          label="Select Candidate"
          isRequired={true}
          isValid={this.state.experiment.candidate !== ''}
          helperText="The candidate deployment of the target service (i.e. reviews-v2)"
          helperTextInvalid="Candidate deployment cannot be empty"
        >
          <TextInput
            id="candidate"
            value={this.state.experiment.candidate}
            placeholder="Select from list or enter a new one"
            onChange={value => this.changeExperiment('candidate', value)}
            list={'candidateName'}
            autoComplete={'off'}
          />
          <datalist id="candidateName">
            {this.state.workloads.map((wk, index) =>
              wk !== this.state.experiment.baseline ? (
                <option label={wk} key={'workloadCandidate' + index} value={wk}>
                  {wk}
                </option>
              ) : (
                ''
              )
            )}
          </datalist>
        </FormGroup>
      </>
    );
  }

  renderBaselineSelect() {
    const isDeployment = this.state.experiment.experimentKind === 'Deployment';
    const usingMap = isDeployment ? this.state.workloads : this.state.services;
    return [
      <FormGroup
        fieldId="baseline"
        label={isDeployment ? 'Deployment Baseline' : 'Service Baseline'}
        isRequired={true}
        isValid={this.state.experiment.baseline !== ''}
        helperText={
          isDeployment
            ? 'The baseline deployment of the target service (i.e. reviews-v1)'
            : 'The baseline service (i.e. reviews)'
        }
        helperTextInvalid={isDeployment ? 'Baseline deployment cannot be empty' : 'Baseline service cannot be empty'}
      >
        <FormSelect
          id="baseline"
          value={this.state.experiment.baseline}
          placeholder={isDeployment ? 'Baseline Deployment' : 'Baseline Service'}
          onChange={value => this.changeExperiment('baseline', value)}
        >
          {usingMap.map((wk, index) => (
            <FormSelectOption label={wk} key={'workloadBaseline' + index} value={wk} />
          ))}
        </FormSelect>
      </FormGroup>
    ];
  }

  renderCandidateSelect() {
    const isDeployment = this.state.experiment.experimentKind === 'Deployment';
    const usingMap = this.state.experiment.experimentKind === 'Deployment' ? this.state.workloads : this.state.services;
    return [
      <FormGroup
        fieldId="candidate"
        label={isDeployment ? 'Deployment Candidate' : 'Service Candidate'}
        isRequired={true}
        isValid={this.state.experiment.candidate !== ''}
        helperText={
          isDeployment
            ? 'The candidate deployment of the target service (i.e. reviews-v2)'
            : 'The candidate service (i.e. reviews)'
        }
        helperTextInvalid={isDeployment ? 'Candidate deployment cannot be empty' : 'Candidate service cannot be empty'}
      >
        <TextInput
          id="candidate"
          value={this.state.experiment.candidate}
          placeholder="Select from list or enter a new one"
          onChange={value => this.changeExperiment('candidate', value)}
          list={'candidateName'}
          autoComplete={'off'}
        />
        <datalist id="candidateName">
          {usingMap.map((wk, index) =>
            wk !== this.state.experiment.baseline ? (
              <option label={wk} key={'workloadCandidate' + index} value={wk}>
                {wk}
              </option>
            ) : (
              ''
            )
          )}
        </datalist>
      </FormGroup>
    ];
  }

  renderFullGeneral() {
    const isNamespacesValid = false;

    return (
      <>
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
        <FormGroup
          fieldId="experimentKind"
          label="Kind of Target"
          isRequired={true}
          helperTextInvalid="Kind of experiment target"
        >
          <FormSelect
            value={this.state.experiment.experimentKind}
            onChange={this.onExperimentKindChange}
            id="targetKind"
            name="targetKinde"
          >
            {iter8oExpOptions.map((option, index) => (
              <FormSelectOption key={index} value={option.value} label={option.label} />
            ))}
          </FormSelect>
        </FormGroup>
        {history.location.pathname.endsWith('/new') ? (
          <>
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
                  this.fetchGateways(value);
                }}
              >
                {this.state.namespaces.map((svc, index) => (
                  <FormSelectOption label={svc} key={'namespace' + index} value={svc} />
                ))}
              </FormSelect>
            </FormGroup>

            {this.state.experiment.experimentKind === 'Deployment' ? (
              <>
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
              </>
            ) : (
              <></>
            )}
          </>
        ) : (
          ''
        )}
        {this.renderBaselineSelect()}
        {this.renderCandidateSelect()}
      </>
    );
  }

  renderTrafficInWizard() {
    return (
      <>
        <FormGroup
          fieldId="interval"
          label="Interval (seconds)"
          isValid={this.state.experiment.trafficControl.interval !== ''}
          helperText="Frequency with which the controller calls the analytics service"
          helperTextInvalid="Interval cannot be empty"
        >
          <TextInput
            id="interval"
            value={this.state.experiment.trafficControl.intervalInSecond}
            placeholder="Time interval i.e. 30s"
            onChange={value => this.changeExperimentNumber('interval', Number(value))}
          />
        </FormGroup>

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
      </>
    );
  }

  renderTraffic() {
    return (
      <>
        <Grid gutter="md">
          <GridItem span={12}>
            <div className={durationTimeStyle}>Total Experiment Duration: {this.state.totalDuration}</div>
          </GridItem>
          <GridItem span={6}>
            <FormGroup
              fieldId="interval"
              label="Interval (seconds)"
              isValid={this.state.experiment.trafficControl.interval !== ''}
              helperText="Frequency with which the controller calls the analytics service"
              helperTextInvalid="Interval cannot be empty"
            >
              <TextInput
                id="interval"
                value={this.state.experiment.trafficControl.intervalInSecond}
                placeholder="Time interval i.e. 30s"
                onChange={value => this.changeExperimentNumber('interval', Number(value))}
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
      </>
    );
  }

  onAddToList = (newCriteria: Criteria, newHost: Host) => {
    this.setState(prevState => {
      if (newHost != null && newHost.name !== '') {
        prevState.experiment.hosts.push(newHost);
      } else if (newCriteria != null) {
        prevState.experiment.criterias.push(newCriteria);
      }
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
          criterias: prevState.experiment.criterias,
          hosts: prevState.experiment.hosts,
          experimentKind: prevState.experiment.experimentKind
        }
      };
    });
  };

  onRemoveFromList = (type: string, index: number) => {
    this.setState(prevState => {
      if (type === 'Criteria') {
        prevState.experiment.criterias.splice(index, 1);
      } else if (type === 'Host') {
        prevState.experiment.hosts.splice(index, 1);
      }

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
          criterias: prevState.experiment.criterias,
          hosts: prevState.experiment.hosts,
          experimentKind: prevState.experiment.experimentKind
        }
      };
    });
  };

  renderCriteria() {
    return (
      <>
        Assesstment Criteria:
        <ExperimentCriteriaForm
          iter8Info={this.state.iter8Info}
          criterias={this.state.experiment.criterias}
          metricNames={this.state.metricNames}
          onAdd={this.onAddToList}
          onRemove={this.onRemoveFromList}
        />
      </>
    );
  }

  renderHost() {
    return (
      <>
        <ExperimentHostForm
          hosts={this.state.experiment.hosts}
          hostsOfGateway={this.state.hostsOfGateway}
          gateways={this.state.gateways}
          onAdd={this.onAddToList}
          onRemove={this.onRemoveFromList}
        />
      </>
    );
  }

  renderSimplePage() {
    return (
      <>
        <hr />
        <Expandable
          toggleText={
            this.state.showAdvanced
              ? history.location.pathname.endsWith('/new')
                ? toggleTextFlat[1]
                : toggleTextWizard[1]
              : history.location.pathname.endsWith('/new')
              ? toggleTextFlat[0]
              : toggleTextWizard[0]
          }
          isExpanded={this.state.showAdvanced}
          onToggle={() => {
            this.setState({
              showAdvanced: !this.state.showAdvanced
            });
          }}
        >
          {this.renderCriteria()}
          <hr />
          <p>&nbsp; &nbsp;&nbsp;</p>
          <h1 className="pf-c-title pf-m-xl">Traffic Control </h1>
          <div className={durationTimeStyle}>Total Experiment Duration: {this.state.totalDuration}</div>
          {this.renderTrafficInWizard()}
          <p>&nbsp; &nbsp;&nbsp;</p>
          {this.renderHost()}
        </Expandable>{' '}
      </>
    );
  }

  renderFullPage() {
    return (
      <>
        {this.renderCriteria()}
        <Form>
          <FormGroup label="Show Traffic Control" fieldId="showTrafficControl">
            <Switch
              id="showTrafficControl"
              label={' '}
              labelOff={' '}
              isChecked={this.state.showTrafficControl}
              onChange={this.onChangeShowTrafficControl}
            />
          </FormGroup>
          {this.state.showTrafficControl && (
            <FormGroup label="Traffic Control" fieldId="trafficControl">
              {this.renderTraffic()}
            </FormGroup>
          )}
          <FormGroup label="Add Host/Gateway" fieldId="addHostGateway">
            <Switch
              id="addHostGateway"
              label={' '}
              labelOff={' '}
              isChecked={this.state.addHostGateway}
              onChange={this.onChangeHostGateway}
            />
          </FormGroup>
          {this.state.addHostGateway && (
            <FormGroup label="Hosts" fieldId="hostsGateways">
              {this.renderHost()}
            </FormGroup>
          )}
        </Form>
      </>
    );
  }

  onChangeHostGateway = () => {
    this.setState(prevState => {
      return {
        addHostGateway: !prevState.addHostGateway
      };
    });
  };

  onChangeShowTrafficControl = () => {
    this.setState(prevState => {
      return {
        showTrafficControl: !prevState.showTrafficControl
      };
    });
  };

  render() {
    const isFormValid = this.isMainFormValid() && this.isSCFormValid();
    return (
      <>
        <RenderContent>
          <div className={containerPadding}>
            <Form className={formPadding} isHorizontal={true}>
              {history.location.pathname.endsWith('/new') ? this.renderFullGeneral() : this.renderGeneral()}
              {history.location.pathname.endsWith('/new') ? this.renderFullPage() : this.renderSimplePage()}

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

const ExperimentCreatePageContainer = connect(mapStateToProps, null)(ExperimentCreatePage);

export default ExperimentCreatePageContainer;
