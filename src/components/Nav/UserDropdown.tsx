import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';
import { SessionTimeout } from '../SessionTimeout/SessionTimeout';
import { config } from '../../config';
import { MILLISECONDS } from '../../types/Common';
import Timer = NodeJS.Timer;
import { LoginSession } from 'src/store/Store';

import moment from 'moment';

type UserProps = {
  session: LoginSession;
  logout: () => void;
  extendSession: (session: LoginSession) => void;
};

type UserState = {
  showSessionTimeOut: boolean;
  timeCountDownSeconds: number;
  checkSessionTimerId?: Timer;
  timeLeftTimerId?: Timer;
  isSessionTimeoutDismissed: boolean;
};

class UserDropdown extends React.Component<UserProps, UserState> {
  constructor(props: UserProps) {
    super(props);
    this.state = {
      showSessionTimeOut: false,
      isSessionTimeoutDismissed: false,
      timeCountDownSeconds: this.timeLeft() / MILLISECONDS
    };
  }
  componentDidMount() {
    const checkSessionTimerId = setInterval(() => {
      this.checkSession();
    }, 3000);
    const timeLeftTimerId = setInterval(() => {
      this.setState({ timeCountDownSeconds: this.timeLeft() / MILLISECONDS });
    }, 1000);

    this.setState({
      checkSessionTimerId: checkSessionTimerId,
      timeLeftTimerId: timeLeftTimerId
    });
  }

  componentWillUnmount() {
    if (this.state.checkSessionTimerId) {
      clearInterval(this.state.checkSessionTimerId);
    }
    if (this.state.timeLeftTimerId) {
      clearInterval(this.state.timeLeftTimerId);
    }
  }

  timeLeft = (): number => {
    const expiresOn = moment(this.props.session.expiresOn);

    if (expiresOn <= moment()) {
      this.handleLogout();
    }

    return expiresOn.diff(moment());
  };

  checkSession = () => {
    if (this.timeLeft() < config.session.timeOutforWarningUser) {
      this.setState({ showSessionTimeOut: true });
    }
  };

  handleLogout() {
    this.props.logout();
  }

  extendSession = (session: LoginSession) => {
    this.props.extendSession(session);
    this.setState({ showSessionTimeOut: false });
  };

  render() {
    return (
      <>
        <SessionTimeout
          onLogout={this.props.logout}
          onExtendSession={this.extendSession}
          onDismiss={this.dismissHandler}
          show={this.state.showSessionTimeOut && !this.state.isSessionTimeoutDismissed}
          timeOutCountDown={this.state.timeCountDownSeconds}
        />
        <Dropdown componentClass="li" id="user">
          <Dropdown.Toggle useAnchor={true} className="nav-item-iconic">
            <Icon type="pf" name="user" /> {this.props.session.username}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <MenuItem id="usermenu_logout" onClick={() => this.handleLogout()}>
              Logout
            </MenuItem>
          </Dropdown.Menu>
        </Dropdown>
      </>
    );
  }

  private dismissHandler = () => {
    this.setState({ isSessionTimeoutDismissed: true });
  };
}

export default UserDropdown;
