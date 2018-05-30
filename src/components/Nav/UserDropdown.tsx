import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';
type UserProps = {
  username: string;
  logout: () => void;
};

type UserState = {};

class UserDropdown extends React.Component<UserProps, UserState> {
  render() {
    return (
      <>
        <Dropdown componentClass="li" id="user">
          <Dropdown.Toggle useAnchor={true} className="nav-item-iconic">
            <Icon type="pf" name="user" /> {this.props.username}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <MenuItem id="usermenu_logout" onClick={() => this.props.logout()}>
              <Icon type="pf" name="key" /> Logout
            </MenuItem>
          </Dropdown.Menu>
        </Dropdown>
      </>
    );
  }
}

export default UserDropdown;
