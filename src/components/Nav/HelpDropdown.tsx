import * as React from 'react';
import { Dropdown, Icon, MenuItem } from 'patternfly-react';

import AboutUIModal from '../About/AboutUIModal';
import { Component } from '../../store/Store';
import DebugInformationContainer from '../../containers/DebugInformationContainer';

type HelpDropdownProps = {
  status: { [key: string]: string };
  components: Component[];
  warningMessages: string[];
};

class HelpDropdown extends React.Component<HelpDropdownProps> {
  about: React.RefObject<AboutUIModal>;
  debugInformation: React.RefObject<any>;

  constructor(props: HelpDropdownProps) {
    super(props);
    this.about = React.createRef<AboutUIModal>();
    this.debugInformation = React.createRef();
  }

  openAbout = () => {
    this.about.current!.open();
  };

  openDebugInformation = () => {
    // Using wrapped component, so we have to get the wrappedInstance
    this.debugInformation.current!.getWrappedInstance().open();
  };

  render() {
    return (
      <>
        <AboutUIModal ref={this.about} status={this.props.status} components={this.props.components} />
        <DebugInformationContainer ref={this.debugInformation} />
        <Dropdown componentClass="li" id="help">
          <Dropdown.Toggle useAnchor={true} className="nav-item-iconic">
            <Icon type="pf" name="help" />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <MenuItem onClick={this.openDebugInformation}>View Debug Info</MenuItem>
            <MenuItem onClick={this.openAbout}>About</MenuItem>
          </Dropdown.Menu>
        </Dropdown>
      </>
    );
  }
}

export default HelpDropdown;
