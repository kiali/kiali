import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';

import AboutUIModal from '../About/AboutUIModal';

class HelpDropdown extends React.Component {
  about: any;

  render() {
    return (
      <>
        <AboutUIModal
          ref={about => {
            this.about = about;
          }}
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
