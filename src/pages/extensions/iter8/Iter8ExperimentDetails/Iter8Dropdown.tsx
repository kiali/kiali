import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Form,
  Modal,
  Text,
  TextVariants,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { WorkloadOverview } from '../../../../types/ServiceInfo';
import TrafficShifting, { WorkloadWeight } from '../../../../components/IstioWizards/TrafficShifting';

export type ManualOverride = {
  TrafficSplit: Map<string, number>;
  totalTrafficSplitPercentage: number;
};

type Props = {
  experimentName: string;
  manualOverride: WorkloadWeight[];
  canDelete: boolean;
  startTime: string;
  endTime: string;
  phase: string;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
  doTrafficSplit: (manualOverride: WorkloadWeight[]) => void;
};

type State = {
  showDeleteConfirmModal: boolean;
  showPauseConfirmModal: boolean;
  showResumeConfirmModal: boolean;
  showTerminateConfirmModal: boolean;
  dropdownOpen: boolean;
  workloadWeights: WorkloadWeight[];
  warning: string;
};

const ITER8_ACTIONS = ['Pause', 'Resume', 'Terminate'];

class Iter8Dropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dropdownOpen: false,
      showDeleteConfirmModal: false,
      showPauseConfirmModal: false,
      showResumeConfirmModal: false,
      showTerminateConfirmModal: false,
      workloadWeights: [],
      warning: ''
    };
  }

  onSelect = _ => {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
  };

  onToggle = (dropdownState: boolean) => {
    this.setState({
      dropdownOpen: dropdownState
    });
  };

  actionConfirmModal = (thisType: string, action: boolean, reset: boolean) => {
    switch (thisType) {
      case 'Delete':
        this.setState({ showDeleteConfirmModal: action });
        break;
      case 'Pause':
        this.setState({ showPauseConfirmModal: action });
        break;
      case 'Resume':
        this.setState({ showResumeConfirmModal: action });
        break;
      case 'Terminate':
        if (reset) {
          this.setState({ warning: '', workloadWeights: this.props.manualOverride });
        }
        this.setState({ showTerminateConfirmModal: action });
        break;
    }
  };

  onAction = (action: string) => {
    this.actionConfirmModal(action, false, false);
    switch (action) {
      case 'Delete':
        this.props.onDelete();
        break;
      case 'Pause':
        this.props.onPause();
        break;
      case 'Resume':
        this.props.onResume();
        break;
      case 'Terminate':
        this.setState({ warning: '' });
        this.props.doTrafficSplit(this.state.workloadWeights);
        this.props.onTerminate();
        break;
    }
  };

  onSelectWeights = (_valid: boolean, workloads: WorkloadWeight[]) => {
    this.setState({
      workloadWeights: workloads
    });
  };

  checkTotalWeight = (): boolean => {
    if (this.state.showTerminateConfirmModal) {
      return this.state.workloadWeights.map(w => w.weight).reduce((a, b) => a + b, 0) === 100;
    }
    return true;
  };

  trafficSplitRules = () => {
    const thisWorkloads: WorkloadOverview[] = [];
    this.props.manualOverride.forEach(w => {
      thisWorkloads.push({
        name: w.name,
        type: 'Workload',
        istioSidecar: false,
        labels: {},
        resourceVersion: 'v',
        createdAt: ''
      });
    });

    return (
      <Form isHorizontal={true}>
        <TrafficShifting
          workloads={thisWorkloads}
          initWeights={this.props.manualOverride}
          onChange={this.onSelectWeights}
          showMirror={false}
          showValid={true}
        />
      </Form>
    );
  };

  GenConfirmModal = (action: string, extraMsg: string, isThisOpen: boolean) => {
    let thisTitle = 'Confirm ' + action;
    return (
      <Modal
        title={thisTitle}
        isSmall={true}
        isOpen={isThisOpen}
        onClose={() => this.actionConfirmModal(action, false, true)}
        actions={[
          <Button key="cancel" variant="secondary" onClick={() => this.actionConfirmModal(action, false, true)}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            variant="danger"
            isDisabled={!this.checkTotalWeight()}
            onClick={() => this.onAction(action)}
          >
            {action}
          </Button>
        ]}
      >
        <Text component={TextVariants.p}>
          Are you sure you want to {action.toLowerCase().split(' ', 3)[0]} the Iter8 experiment "
          {this.props.experimentName}"{extraMsg}
        </Text>

        {action === 'Terminate' ? <>{this.trafficSplitRules()}</> : ''}
      </Modal>
    );
  };

  canAction = (action: string, phase: string): boolean => {
    switch (action) {
      case 'Terminate':
        return this.props.startTime !== '' && this.props.endTime === '';
    }
    return this.props.startTime !== '' && this.props.phase === phase;
  };

  renderTooltip = (key, position, msg, child): any => {
    return (
      <Tooltip key={key} position={position} content={<>{msg}</>}>
        <div style={{ cursor: 'not-allowed' }}>{child}</div>
      </Tooltip>
    );
  };

  renderDropdownItem = (actionString: string): any => {
    const actions = actionString.split(' ');
    let eventKey = actions[0] + 'Experiment';
    let checkPhase = actionString === 'Pause' ? 'Progressing' : 'Pause';

    let msgString =
      this.props.startTime === ''
        ? '. Action "' + actionString + '" can only be done once experiment is started. '
        : this.props.endTime !== ''
        ? '. Action "' + actionString + '" can only be done while experiment is running. '
        : '';

    let item = (
      <DropdownItem
        key={eventKey}
        onClick={() => this.actionConfirmModal(actionString, true, true)}
        isDisabled={!this.canAction(actions[0], checkPhase)}
      >
        {actionString}
      </DropdownItem>
    );
    return !this.canAction(actions[0], checkPhase)
      ? this.renderTooltip(
          eventKey,
          TooltipPosition.left,
          'Experiment is in state ' + this.props.phase + msgString,
          item
        )
      : item;
  };

  renderDropdownItems = (): any => {
    let items: any[] = [];
    if (this.props.canDelete) {
      items = items.concat(
        <DropdownItem
          key="deleteExperiment"
          onClick={() => this.actionConfirmModal('Delete', true, false)}
          isDisabled={!this.props.canDelete}
        >
          Delete
        </DropdownItem>
      );
    }
    items = items.concat(ITER8_ACTIONS.map(action => this.renderDropdownItem(action)));
    return items;
  };

  render() {
    return (
      <>
        <Dropdown
          id="actions"
          title="Actions"
          toggle={<DropdownToggle onToggle={this.onToggle}>Actions</DropdownToggle>}
          onSelect={this.onSelect}
          position={DropdownPosition.right}
          isOpen={this.state.dropdownOpen}
          dropdownItems={this.renderDropdownItems()}
        />
        {this.GenConfirmModal(
          'Delete',
          '? It cannot be undone. Make sure this is something you really want to do!',
          this.state.showDeleteConfirmModal
        )}
        {this.GenConfirmModal('Resume', '? ', this.state.showResumeConfirmModal)}
        {this.GenConfirmModal(
          'Pause',
          '? Once it is paused, please select "resume" to resume the experiment. Or use terminate to stop the experiment. ',
          this.state.showPauseConfirmModal
        )}
        {this.GenConfirmModal(
          'Terminate',
          '? Please specify traffic split rule ',
          this.state.showTerminateConfirmModal
        )}
      </>
    );
  }
}

export default Iter8Dropdown;
