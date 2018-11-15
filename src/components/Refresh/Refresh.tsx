import * as React from 'react';
import { Button, MenuItem, Icon, DropdownButton } from 'patternfly-react';

import { config } from '../../config';
import { PollIntervalInMs } from '../../types/Common';

type ComponentProps = {
  id: string;
  handleRefresh: () => void;
};

type ReduxProps = {
  pollInterval: PollIntervalInMs;
  setRefreshInterval: (pollInterval: PollIntervalInMs) => void;
};

type Props = ComponentProps & ReduxProps;

type State = {
  pollInterval?: PollIntervalInMs;
  pollerRef?: number;
};

const POLL_INTERVALS = config().toolbar.pollInterval;

class Refresh extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    let pollerRef: number | undefined = undefined;
    if (this.props.pollInterval) {
      pollerRef = window.setInterval(this.props.handleRefresh, this.props.pollInterval);
    }
    this.state = {
      pollInterval: this.props.pollInterval,
      pollerRef: pollerRef
    };
  }

  componentWillUnmount() {
    if (this.state.pollerRef) {
      clearInterval(this.state.pollerRef);
    }
  }

  updatePollInterval = (pollInterval: PollIntervalInMs) => {
    let newRefInterval: number | undefined = undefined;
    if (this.state.pollerRef) {
      clearInterval(this.state.pollerRef);
    }
    if (pollInterval > 0) {
      newRefInterval = window.setInterval(this.props.handleRefresh, pollInterval);
    }
    this.setState({ pollerRef: newRefInterval, pollInterval: pollInterval });
    this.props.setRefreshInterval(pollInterval); // notify redux of the change
  };

  render() {
    if (this.state.pollInterval !== undefined) {
      return (
        <>
          <label style={{ paddingRight: '0.5em', marginLeft: '1.5em' }}>Refreshing</label>
          <DropdownButton id={this.props.id} title={POLL_INTERVALS[this.state.pollInterval]}>
            {Object.keys(POLL_INTERVALS).map(strKey => {
              const key = Number(strKey);
              return (
                <MenuItem
                  key={key}
                  eventKey={key}
                  active={key === this.state.pollInterval}
                  onSelect={this.updatePollInterval}
                >
                  {POLL_INTERVALS[key]}
                </MenuItem>
              );
            })}
          </DropdownButton>
          <span style={{ paddingLeft: '0.5em' }}>
            <Button id={this.props.id + '_btn'} onClick={this.props.handleRefresh}>
              <Icon name="refresh" />
            </Button>
          </span>
        </>
      );
    } else {
      return this.renderButtonOnly();
    }
  }

  renderButtonOnly() {
    return (
      <Button id="refresh_button" onClick={this.props.handleRefresh}>
        <Icon name="refresh" />
      </Button>
    );
  }
}

export default Refresh;
