import * as React from 'react';
import { SessionTimeout } from '../../SessionTimeout/SessionTimeout';
import { config } from '../../../config';
import { isMultiCluster } from '../../../config';
import { MILLISECONDS } from '../../../types/Common';
import { Timer } from 'globals';
import { KialiAppState, LoginSession } from '../../../store/Store';
import { authenticationConfig } from '../../../config/AuthenticationConfig';
import { AuthStrategy } from '../../../types/Auth';
import moment from 'moment';
import { KialiDispatch } from 'types/Redux';
import { LoginThunkActions } from '../../../actions/LoginThunkActions';
import { connect } from 'react-redux';
import * as API from '../../../services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { namespacesPerClusterSelector } from 'store/Selectors';
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';

type ReduxProps = {
  clusters?: string[];
  session?: LoginSession;
};

type ReduxDispatchProps = {
  extendSession: (session: LoginSession) => void;
  logout: () => void;
};

type UserProps = ReduxProps & ReduxDispatchProps;

type UserState = {
  checkSessionTimerId?: Timer;
  isDropdownOpen: boolean;
  isSessionTimeoutDismissed: boolean;
  showSessionTimeOut: boolean;
  timeCountDownSeconds: number;
  timeLeftTimerId?: Timer;
};

const dropdownStyle = kialiStyle({
  paddingLeft: 0,
  paddingRight: 0
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

  componentDidMount(): void {
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

  componentWillUnmount(): void {
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

  checkSession = (): void => {
    if (this.timeLeft() < config.session.timeOutforWarningUser) {
      this.setState({ showSessionTimeOut: true });
    }
  };

  handleLogout = (): void => {
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

  extendSession = (session: LoginSession): void => {
    this.props.extendSession(session);
    this.setState({ showSessionTimeOut: false });
  };

  onDropdownToggle = (isDropdownOpen: boolean): void => {
    this.setState({
      isDropdownOpen
    });
  };

  onDropdownSelect = (_event: any): void => {
    this.setState({
      isDropdownOpen: !this.state.isDropdownOpen
    });
  };

  render(): JSX.Element {
    const { isDropdownOpen } = this.state;

    const clusterIsInSessionInfo = (cluster: string): boolean =>
      this.props.session?.clusterInfo?.[cluster] !== undefined;

    const canLogout =
      authenticationConfig.strategy !== AuthStrategy.anonymous && authenticationConfig.strategy !== AuthStrategy.header;

    // We want to show a dropdown per cluster the user is not logged into yet.
    // The clusters you are logged into are in session.clusterInfo and all
    // the clusters are in authenticationConfig.authorizationEndpointPerCluster.
    // So the clusters you are not logged into is authenticationConfig.authorizationEndpointPerCluster - session.clusterInfo.
    // Two groups of clusters: those you are logged into and those you are not.
    let loggedInClusters: { cluster: string; endpoint: string }[] = [];
    let loggedOutClusters: { cluster: string; endpoint: string }[] = [];
    if (authenticationConfig.authorizationEndpointPerCluster !== undefined) {
      Object.entries(authenticationConfig.authorizationEndpointPerCluster).forEach(([cluster, endpoint]) => {
        clusterIsInSessionInfo(cluster)
          ? loggedInClusters.push({ cluster: cluster, endpoint: endpoint })
          : loggedOutClusters.push({ cluster: cluster, endpoint: endpoint });
      });
    }

    return (
      <>
        <SessionTimeout
          onLogout={this.props.logout}
          onExtendSession={this.extendSession}
          onDismiss={this.dismissHandler}
          show={this.state.showSessionTimeOut && !this.state.isSessionTimeoutDismissed}
          timeOutCountDown={this.state.timeCountDownSeconds}
        />

        {this.props.session && !canLogout && <>{this.props.session.username}</>}

        {this.props.session && canLogout && (
          <Dropdown
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                className={dropdownStyle}
                variant="plainText"
                onClick={() => this.onDropdownToggle(!isDropdownOpen)}
                isExpanded={isDropdownOpen}
              >
                {this.props.session?.username}
              </MenuToggle>
            )}
            isOpen={isDropdownOpen}
            onSelect={this.onDropdownSelect}
            popperProps={{ position: 'right' }}
            onOpenChange={(isOpen: boolean) => this.onDropdownToggle(isOpen)}
          >
            {isMultiCluster && loggedInClusters.length > 0 && (
              <>
                <DropdownGroup label="logged-in clusters" labelHeadingLevel="h3">
                  <DropdownList>
                    {loggedInClusters.map(clusterInfo => {
                      return (
                        <DropdownItem isDisabled={true} key={clusterInfo.cluster}>
                          {clusterInfo.cluster}
                        </DropdownItem>
                      );
                    })}
                  </DropdownList>
                </DropdownGroup>
                <Divider component="li" />
              </>
            )}
            {isMultiCluster && loggedOutClusters.length > 0 && (
              <>
                <DropdownGroup label="logged-out clusters" labelHeadingLevel="h3">
                  <DropdownList>
                    {loggedOutClusters.map(clusterInfo => {
                      return (
                        <DropdownItem key={clusterInfo.cluster} to={clusterInfo.endpoint}>
                          Login to {clusterInfo.cluster}
                        </DropdownItem>
                      );
                    })}
                  </DropdownList>
                </DropdownGroup>
                <Divider component="li" />
              </>
            )}
            <DropdownItem key={'user_logout_option'} onClick={this.handleLogout} isDisabled={!canLogout}>
              Logout
            </DropdownItem>
          </Dropdown>
        )}

        {authenticationConfig.strategy === AuthStrategy.openshift && authenticationConfig.logoutEndpoint && (
          <form id="openshiftlogout" action={authenticationConfig.logoutEndpoint} method="post">
            <input type="hidden" name="then" value={authenticationConfig.logoutRedirect} />
          </form>
        )}
      </>
    );
  }

  private dismissHandler = (): void => {
    this.setState({ isSessionTimeoutDismissed: true });
  };
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  clusters: Array.from(namespacesPerClusterSelector(state).keys()),
  session: state.authentication.session
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  logout: () => dispatch(LoginThunkActions.logout()),
  extendSession: (session: LoginSession) => dispatch(LoginThunkActions.extendSession(session))
});

export const UserDropdown = connect(mapStateToProps, mapDispatchToProps)(UserDropdownComponent);
