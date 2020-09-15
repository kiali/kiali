import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Form,
  FormGroup,
  Modal,
  Text,
  TextVariants,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';

export type ManualOverride = {
  TrafficSplit: Map<string, number>;
  totalTrafficSplitPercentage: number;
};

type Props = {
  experimentName: string;
  manualOverride: ManualOverride;
  canDelete: boolean;
  startTime: string;
  endTime: string;
  phase: string;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
  doTrafficSplit: (manualOverride: ManualOverride) => void;
};

type State = {
  showDeleteConfirmModal: boolean;
  showPauseConfirmModal: boolean;
  showResumeConfirmModal: boolean;
  showTerminateConfirmModal: boolean;
  dropdownOpen: boolean;
  manualOverride: ManualOverride;
  candidates: string[];
};

const ITER8_ACTIONS = ['Pause', 'Resume', 'Terminate'];

class Iter8Dropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    let candidates: string[] = [];
    this.props.manualOverride.TrafficSplit.forEach((_, key: string) => {
      candidates.push(key);
    });

    this.state = {
      dropdownOpen: false,
      showDeleteConfirmModal: false,
      showPauseConfirmModal: false,
      showResumeConfirmModal: false,
      showTerminateConfirmModal: false,
      manualOverride: this.props.manualOverride,
      candidates: candidates
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

  actionConfirmModal = (thisType: string, action: boolean) => {
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
        this.setState({ showTerminateConfirmModal: action });
        break;
    }
  };

  onAction = (action: string) => {
    this.actionConfirmModal(action, false);
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
        this.props.onTerminate();
        break;
    }
  };

  setTrafficSplit(val, name) {
    this.setState(
      prevState => {
        let total = 0;
        prevState.manualOverride.TrafficSplit.set(name, val);
        for (let entry of Array.from(prevState.manualOverride.TrafficSplit.entries())) {
          total = total + Number(entry[1]);
        }
        prevState.manualOverride.totalTrafficSplitPercentage = total;

        return {
          manualOverride: prevState.manualOverride
        };
      },
      () => this.props.doTrafficSplit(this.state.manualOverride)
    );
  }

  trafficSplitRules = () => {
    return (
      <Form isHorizontal={true}>
        {this.state.candidates.map(c => {
          return (
            <>
              <FormGroup
                fieldId={c}
                label={c}
                isRequired={true}
                helperTextInvalid="Total Percentage must be equal to 100%"
                isValid={this.state.manualOverride.totalTrafficSplitPercentage === 100}
              >
                <TextInput
                  id={c}
                  type="number"
                  value={this.state.manualOverride[c]}
                  placeholder="Traffic Split Percentage"
                  onChange={value => this.setTrafficSplit(value, c)}
                />
              </FormGroup>
            </>
          );
        })}
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
        onClose={() => this.actionConfirmModal(action, false)}
        actions={[
          <Button key="cancel" variant="secondary" onClick={() => this.actionConfirmModal(action, false)}>
            Cancel
          </Button>,
          <Button key="confirm" variant="danger" onClick={() => this.onAction(action)}>
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
        onClick={() => this.actionConfirmModal(actionString, true)}
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
          onClick={() => this.actionConfirmModal('Delete', true)}
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
