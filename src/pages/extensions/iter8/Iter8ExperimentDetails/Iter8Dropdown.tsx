import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Modal,
  Text,
  TextVariants,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';

type Props = {
  experimentName: string;
  canDelete: boolean;
  startedAt: number;
  endedAt: number;
  phase: string;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onSuccess: () => void;
  onFailure: () => void;
};

type State = {
  showDeleteConfirmModal: boolean;
  showPauseConfirmModal: boolean;
  showResumeConfirmModal: boolean;
  showSuccessConfirmModal: boolean;
  showFailureConfirmModal: boolean;
  dropdownOpen: boolean;
};

const ITER8_ACTIONS = ['Pause', 'Resume', 'Terminate with Failure', 'Terminate with Success'];

class Iter8Dropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      dropdownOpen: false,
      showDeleteConfirmModal: false,
      showPauseConfirmModal: false,
      showResumeConfirmModal: false,
      showSuccessConfirmModal: false,
      showFailureConfirmModal: false
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
      case 'Terminate with Success':
        this.setState({ showSuccessConfirmModal: action });
        break;
      case 'Terminate with Failure':
        this.setState({ showFailureConfirmModal: action });
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
      case 'Terminate with Success':
        this.props.onSuccess();
        break;
      case 'Terminate with Failure':
        this.props.onFailure();
        break;
    }
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
      </Modal>
    );
  };

  canAction = (action: string, phase: string): boolean => {
    switch (action) {
      case 'Terminate':
        return this.props.startedAt !== 0 && this.props.endedAt === 0;
    }
    return this.props.startedAt !== 0 && this.props.phase === phase;
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
      this.props.startedAt === 0
        ? '. Action "' + actionString + '" can only be done once experiment is started. '
        : this.props.endedAt !== 0
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
    var items: any[] = [];
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
          'Terminate with Success',
          ' indicating that the candidate succeeded?',
          this.state.showSuccessConfirmModal
        )}
        {this.GenConfirmModal(
          'Terminate with Failure',
          ' indicating that the candidate failed?',
          this.state.showFailureConfirmModal
        )}
      </>
    );
  }
}

export default Iter8Dropdown;
