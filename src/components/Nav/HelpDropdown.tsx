import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';

import AboutUIModal from '../About/AboutUIModal';
import { Component } from '../../store/Store';

type HelpDropdownProps = {
  status: { [key: string]: string };
  components: Component[];
  warningMessages: string[];
};
type HelpDropdownState = {};

class HelpDropdown extends React.Component<HelpDropdownProps, HelpDropdownState> {
  about: any;

  constructor(props: HelpDropdownProps) {
    super(props);
  }

  render() {
    return (
      <>
        <AboutUIModal
          ref={about => {
            this.about = about;
          }}
          status={this.props.status}
          components={this.props.components}
        />
        <Dropdown componentClass="li" id="help">
          <Dropdown.Toggle useAnchor={true} className="nav-item-iconic">
            <Icon type="pf" name="help" />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <MenuItem onClick={() => this.about.open()}>About</MenuItem>
          </Dropdown.Menu>
        </Dropdown>
      </>
    );
  }
}

export default HelpDropdown;
