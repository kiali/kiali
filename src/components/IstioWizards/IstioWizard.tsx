import * as React from 'react';
import {
  Button,
  Col,
  ControlLabel,
  DropdownButton,
  Label,
  ListView,
  ListViewIcon,
  ListViewItem,
  MenuItem,
  Row,
  Wizard
} from 'patternfly-react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import Slider from './Slider/Slider';
import { DestinationRule, VirtualService } from '../../types/IstioObjects';
import { serverConfig } from '../../config/serverConfig';
import { authentication } from '../../utils/Authentication';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { style } from 'typestyle';

type Props = {
  show: boolean;
  namespace: string;
  serviceName: string;
  workloads: WorkloadOverview[];
  onClose: (changed: boolean) => void;
};

type WorkloadTraffic = {
  name: string;
  traffic: number;
};

type State = {
  showWizard: boolean;
  workloads: WorkloadTraffic[];
  mtlsMode: string;
  loadBalancer: string;
};

const tlsStyle = style({
  marginLeft: 20,
  marginRight: 20
});

const lbStyle = style({
  marginLeft: 40,
  marginRight: 20
});

const NONE = 'NONE';

const loadBalancerSimple: string[] = [NONE, 'ROUND_ROBIN', 'LEAST_CONN', 'RANDOM', 'PASSTHROUGH'];

const mTLSMode: string[] = [NONE, 'ISTIO_MUTUAL', 'MUTUAL', 'SIMPLE', 'DISABLE'];

class IstioWizard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showWizard: false,
      workloads: [],
      mtlsMode: NONE,
      loadBalancer: NONE
    };
  }

  resetState = () => {
    if (this.props.workloads.length === 0) {
      return;
    }
    const wkTraffic = this.props.workloads.length < 100 ? Math.round(100 / this.props.workloads.length) : 0;
    const remainTraffic = this.props.workloads.length < 100 ? 100 % this.props.workloads.length : 0;
    const workloads: WorkloadTraffic[] = this.props.workloads.map(workload => ({
      name: workload.name,
      traffic: wkTraffic
    }));
    if (remainTraffic > 0) {
      workloads[workloads.length - 1].traffic = workloads[workloads.length - 1].traffic + remainTraffic;
    }
    this.setState({
      showWizard: this.props.show,
      workloads: workloads
    });
  };

  compareWorkloads = (prev: WorkloadOverview[], current: WorkloadOverview[]): boolean => {
    if (prev.length !== current.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (!current.includes(prev[i])) {
        return false;
      }
    }
    return true;
  };

  componentDidMount() {
    this.resetState();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.show !== this.props.show || !this.compareWorkloads(prevProps.workloads, this.props.workloads)) {
      this.resetState();
    }
  }

  createIstioTraffic = (): [DestinationRule, VirtualService] => {
    const wkdNameVersion: { [key: string]: string } = {};

    // DestinationRule from the labels
    const wizardDR: DestinationRule = {
      metadata: {
        namespace: this.props.namespace,
        name: this.props.serviceName
      },
      spec: {
        host: this.props.serviceName,
        subsets: this.props.workloads.map(workload => {
          // Using version
          const versionLabelName = serverConfig().istioLabels.versionLabelName;
          const versionValue = workload.labels![versionLabelName];
          const labels: { [key: string]: string } = {};
          labels[versionLabelName] = versionValue;
          // Populate helper table
          wkdNameVersion[workload.name] = versionValue;
          return {
            name: versionValue,
            labels: labels
          };
        })
      }
    };

    if (this.state.mtlsMode !== NONE || this.state.loadBalancer !== NONE) {
      wizardDR.spec.trafficPolicy = {};
      if (this.state.mtlsMode !== NONE) {
        wizardDR.spec.trafficPolicy.tls = {
          mode: this.state.mtlsMode
        };
      }
      if (this.state.loadBalancer !== NONE) {
        wizardDR.spec.trafficPolicy.loadBalancer = {
          simple: this.state.loadBalancer
        };
      }
    }

    // VirtualService from the weights
    const wizardVS: VirtualService = {
      metadata: {
        namespace: this.props.namespace,
        name: this.props.serviceName
      },
      spec: {
        hosts: [this.props.serviceName],
        http: [
          {
            route: this.state.workloads.map(workload => {
              return {
                destination: {
                  host: this.props.serviceName,
                  subset: wkdNameVersion[workload.name]
                },
                weight: workload.traffic
              };
            })
          }
        ]
      }
    };
    return [wizardDR, wizardVS];
  };

  onClose = () => {
    this.setState({ showWizard: false });
    this.props.onClose(false);
  };

  onCreate = () => {
    const [dr, vr] = this.createIstioTraffic();
    const createDR = API.createIstioConfigDetail(
      authentication(),
      this.props.namespace,
      'destinationrules',
      JSON.stringify(dr)
    );
    const createVS = API.createIstioConfigDetail(
      authentication(),
      this.props.namespace,
      'virtualservices',
      JSON.stringify(vr)
    );
    Promise.all([createDR, createVS])
      .then(results => {
        this.props.onClose(true);
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not create Istio config objects', error));
      });
  };

  onTLS = (mTLS: string) => {
    this.setState({
      mtlsMode: mTLS
    });
  };

  onLoadBalancer = (simple: string) => {
    this.setState({
      loadBalancer: simple
    });
  };

  onWeight = (workloadName: string, newWeight: number) => {
    this.setState(prevState => {
      const nodeId: number[] = [];
      // Set new weight, remember rest of the list
      for (let i = 0; i < prevState.workloads.length; i++) {
        if (prevState.workloads[i].name === workloadName) {
          prevState.workloads[i].traffic = newWeight;
        } else {
          nodeId.push(i);
        }
      }
      // Just let auto sliders adjusment per 2 workloads as when >2 some corner cases are not clear
      if (prevState.workloads.length === 2) {
        // Distribute pending weights
        const maxWeights = 100 - newWeight;
        let sumWeights = 0;
        for (let j = 0; j < nodeId.length; j++) {
          if (sumWeights + prevState.workloads[nodeId[j]].traffic > maxWeights) {
            prevState.workloads[nodeId[j]].traffic = maxWeights - sumWeights;
          }
          sumWeights += prevState.workloads[nodeId[j]].traffic;
        }
        // Adjust last element
        if (nodeId.length > 0 && sumWeights < maxWeights) {
          prevState.workloads[nodeId[nodeId.length - 1]].traffic += maxWeights - sumWeights;
        }
      }
      return {
        workloads: prevState.workloads
      };
    });
  };

  checkWeight = (): boolean => {
    // Check all weights are equal to 100
    return this.state.workloads.map(w => w.traffic).reduce((a, b) => a + b, 0) === 100;
  };

  renderWorkloads = () => {
    const iconType = 'pf';
    const iconName = 'bundle';
    return this.state.workloads.map((workload, id) => {
      return (
        <ListViewItem
          key={'workload-' + id}
          leftContent={<ListViewIcon type={iconType} name={iconName} />}
          heading={workload.name}
          description={
            <Slider
              id={'slider-' + workload.name}
              key={'slider-' + workload.name}
              tooltip={true}
              input={true}
              inputFormat="%"
              label={'Traffic Weight'}
              value={workload.traffic}
              onSlide={value => {
                value = Math.round((value as number) || 0);
                if (value > 100) {
                  value = 100;
                }
                if (value < 0) {
                  value = 0;
                }
                this.onWeight(workload.name, value as number);
              }}
            />
          }
        />
      );
    });
  };

  renderTrafficPolicy = () => {
    const tlsMenuItems: any[] = mTLSMode.map(mode => (
      <MenuItem key={mode} eventKey={mode} active={mode === this.state.mtlsMode}>
        {mode}
      </MenuItem>
    ));
    const lbMenuItems: any[] = loadBalancerSimple.map(simple => (
      <MenuItem key={simple} eventKey={simple} active={simple === this.state.loadBalancer}>
        {simple}
      </MenuItem>
    ));
    return (
      <Row>
        <Col sm={12}>
          <ControlLabel className={tlsStyle}>TLS</ControlLabel>
          <DropdownButton bsStyle="default" title={this.state.mtlsMode} id="trafficPolicy-tls" onSelect={this.onTLS}>
            {tlsMenuItems}
          </DropdownButton>
          <ControlLabel className={lbStyle}>LoadBalancer</ControlLabel>
          <DropdownButton
            bsStyle="default"
            title={this.state.loadBalancer}
            id="trafficPolicy-lb"
            onSelect={this.onLoadBalancer}
          >
            {lbMenuItems}
          </DropdownButton>
        </Col>
      </Row>
    );
  };

  renderContent = () => {
    return (
      <Wizard.Contents stepIndex={0} activeStepIndex={0}>
        <ListView>{this.renderWorkloads()}</ListView>
        {this.renderTrafficPolicy()}
      </Wizard.Contents>
    );
  };

  render() {
    return (
      <Wizard show={this.state.showWizard} onHide={this.onClose}>
        <Wizard.Header onClose={this.onClose} title="Create Traffic Routing" />
        <Wizard.Body>
          <Wizard.Row>
            <Wizard.Main>{this.renderContent()}</Wizard.Main>
          </Wizard.Row>
        </Wizard.Body>
        <Wizard.Footer>
          {!this.checkWeight() && (
            <Label style={{ margin: '0 15px 0 0', paddingTop: '6px' }} bsStyle="danger">
              Traffic Weights must sum 100%
            </Label>
          )}
          <Button bsStyle="default" className="btn-cancel" onClick={this.onClose}>
            Cancel
          </Button>
          <Button disabled={!this.checkWeight()} bsStyle="primary" onClick={this.onCreate}>
            Create
          </Button>
        </Wizard.Footer>
      </Wizard>
    );
  }
}

export default IstioWizard;
