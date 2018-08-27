import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';
import { SessionTimeout } from '../SessionTimeout/SessionTimeout';
import { config } from '../../config';
import { MILLISECONDS } from '../../types/Common';

type UserProps = {
  username: string;
  logout: () => void;
  extendSession: () => void;
  sessionTimeOut: number;
};

type UserState = {
  showSessionTimeOut: boolean;
  timeCountDownSeconds: number;
};

class UserDropdown extends React.Component<UserProps, UserState> {
  constructor(props: UserProps) {
    super(props);
    this.state = {
      showSessionTimeOut: false,
      timeCountDownSeconds: this.timeLeft() / MILLISECONDS
    };
  }
  componentDidMount() {
    setInterval(() => {
      this.checkSession();
    }, 3000);

    setInterval(() => {
      this.setState({ timeCountDownSeconds: this.timeLeft() / MILLISECONDS });
    }, 1000);
  }

  timeLeft = (): number => {
    const nowDate = new Date().getTime();
    return this.props.sessionTimeOut - nowDate;
  };

  checkSession = () => {
    if (this.timeLeft() < config().session.timeOutforWarningUser) {
      this.setState({ showSessionTimeOut: true });
    }
  };

  handleLogout() {
    this.props.logout();
    document.documentElement.className = 'login-pf';
  }

  extendSession = () => {
    this.props.extendSession();
    this.setState({ showSessionTimeOut: false });
  };

  render() {
    return (
      <>
        <SessionTimeout
          logout={this.props.logout}
          extendSession={this.extendSession}
          show={this.state.showSessionTimeOut}
          timeOutCountDown={this.state.timeCountDownSeconds}
        />
        <Dropdown componentClass="li" id="user">
          <Dropdown.Toggle useAnchor={true} className="nav-item-iconic">
            <Icon type="pf" name="user" /> {this.props.username}
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
}

export default UserDropdown;
