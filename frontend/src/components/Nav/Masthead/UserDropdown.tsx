import * as React from 'react';
import { Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core';
import { SessionTimeout } from '../../SessionTimeout/SessionTimeout';
import { config } from '../../../config';
import { KIALI_THEME, MILLISECONDS, PF_THEME_DARK, Theme } from '../../../types/Common';
import { Timer } from 'globals';
import { KialiAppState, LoginSession } from '../../../store/Store';
import { authenticationConfig } from '../../../config/AuthenticationConfig';
import { AuthStrategy } from '../../../types/Auth';
import moment from 'moment';
import { KialiDispatch } from 'types/Redux';
import { LoginThunkActions } from '../../../actions/LoginThunkActions';
import { connect } from 'react-redux';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { GlobalActions } from '../../../actions/GlobalActions';
import { kialiStyle } from 'styles/StyleUtils';

type UserProps = {
  session?: LoginSession;
  theme: string;
  logout: () => void;
  extendSession: (session: LoginSession) => void;
};

type UserState = {
  showSessionTimeOut: boolean;
  timeCountDownSeconds: number;
  checkSessionTimerId?: Timer;
  timeLeftTimerId?: Timer;
  isDropdownOpen: boolean;
  isSessionTimeoutDismissed: boolean;
};

const dropdownStyle = kialiStyle({
  $nest: {
    button: {
      padding: 0
    }
  }
});

class UserDropdownComponent extends React.Component<UserProps, UserState> {
  constructor(props: UserProps) {
    super(props);
    this.state = {
      showSessionTimeOut: false,
      timeCountDownSeconds: this.timeLeft() / MILLISECONDS,
      isSessionTimeoutDismissed: false,
      isDropdownOpen: false
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
    const expiresOn = moment(this.props.session!.expiresOn);

    if (expiresOn <= moment()) {
      this.props.logout();
    }

    return expiresOn.diff(moment());
  };

  checkSession = () => {
    if (this.timeLeft() < config.session.timeOutforWarningUser) {
      this.setState({ showSessionTimeOut: true });
    }
  };

  handleLogout = () => {
    if (authenticationConfig.logoutEndpoint) {
      API.logout()
        .then(_ => {
          (document.getElementById('openshiftlogout') as HTMLFormElement).submit();
        })
        .catch(error => {
          const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
          console.error(`Logout failed. "kiali-token" cookie may need to be cleared manually: ${errorMsg}`);
          (document.getElementById('openshiftlogout') as HTMLFormElement).submit();
        });
    } else {
      this.props.logout();
    }
  };

  handleTheme = () => {
    if (this.props.theme === Theme.LIGHT) {
      document.documentElement.classList.add(PF_THEME_DARK);
      store.dispatch(GlobalActions.setTheme(Theme.DARK));
      localStorage.setItem(KIALI_THEME, Theme.DARK);
    } else {
      document.documentElement.classList.remove(PF_THEME_DARK);
      store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
      localStorage.setItem(KIALI_THEME, Theme.LIGHT);
    }

    // Refresh page to load new theme (certain components are not reloaded like cytoscape graph)
    const refreshTick = new CustomEvent('refreshTick', { detail: Date.now() });
    document.dispatchEvent(refreshTick);
  };

  extendSession = (session: LoginSession) => {
    this.props.extendSession(session);
    this.setState({ showSessionTimeOut: false });
  };

  onDropdownToggle = isDropdownOpen => {
    this.setState({
      isDropdownOpen
    });
  };

  onDropdownSelect = _event => {
    this.setState({
      isDropdownOpen: !this.state.isDropdownOpen
    });
  };

  render() {
    const { isDropdownOpen } = this.state;
    const canLogout =
      authenticationConfig.strategy !== AuthStrategy.anonymous && authenticationConfig.strategy !== AuthStrategy.header;

    const userDropdownItems = (
      <>
        {' '}
        {canLogout && (
          <DropdownItem key={'user_logout_option'} onClick={this.handleLogout} isDisabled={!canLogout}>
            Logout
          </DropdownItem>
        )}
        <DropdownItem key={'theme_update'} onClick={this.handleTheme}>
          {this.props.theme === Theme.DARK ? Theme.LIGHT : Theme.DARK} theme
        </DropdownItem>
      </>
    );
    return (
      <>
        <SessionTimeout
          onLogout={this.props.logout}
          onExtendSession={this.extendSession}
          onDismiss={this.dismissHandler}
          show={this.state.showSessionTimeOut && !this.state.isSessionTimeoutDismissed}
          timeOutCountDown={this.state.timeCountDownSeconds}
        />
        {this.props.session && (
          <Dropdown
            className={dropdownStyle}
            isPlain={true}
            position="right"
            onSelect={this.onDropdownSelect}
            isOpen={isDropdownOpen}
            toggle={
              <DropdownToggle id={'user-dropdown-toggle'} onToggle={this.onDropdownToggle}>
                {this.props.session.username}
              </DropdownToggle>
            }
            dropdownItems={[userDropdownItems]}
          />
        )}
        {authenticationConfig.strategy === AuthStrategy.openshift && authenticationConfig.logoutEndpoint && (
          <form id="openshiftlogout" action={authenticationConfig.logoutEndpoint} method="post">
            <input type="hidden" name="then" value={authenticationConfig.logoutRedirect} />
          </form>
        )}
      </>
    );
  }

  private dismissHandler = () => {
    this.setState({ isSessionTimeoutDismissed: true });
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  session: state.authentication.session,
  theme: state.globalState.theme
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  logout: () => dispatch(LoginThunkActions.logout()),
  extendSession: (session: LoginSession) => dispatch(LoginThunkActions.extendSession(session))
});

export const UserDropdown = connect(mapStateToProps, mapDispatchToProps)(UserDropdownComponent);
