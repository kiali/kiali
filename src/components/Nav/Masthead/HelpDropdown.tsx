import * as React from 'react';
import AboutUIModal from '../../About/AboutUIModal';
import { Component, KialiAppState } from '../../../store/Store';
import DebugInformationContainer from '../../../components/DebugInformation/DebugInformation';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';

type HelpDropdownProps = {
  status: { [key: string]: string };
  components: Component[];
  warningMessages: string[];
};

interface HelpDropdownState {
  isDropdownOpen: boolean;
}

class HelpDropdownContainer extends React.Component<HelpDropdownProps, HelpDropdownState> {
  about: React.RefObject<AboutUIModal>;
  debugInformation: React.RefObject<any>;

  constructor(props: HelpDropdownProps) {
    super(props);
    this.state = { isDropdownOpen: false };
    this.about = React.createRef<AboutUIModal>();
    this.debugInformation = React.createRef();
  }

  openAbout = e => {
    e.preventDefault();
    this.about.current!.open();
  };

  openDebugInformation = e => {
    e.preventDefault();
    // Using wrapped component, so we have to get the wrappedInstance
    this.debugInformation.current!.getWrappedInstance().open();
  };

  onDropdownToggle = isDropdownOpen => {
    this.setState({
      isDropdownOpen
    });
  };

  onDropdownSelect = () => {
    this.setState({
      isDropdownOpen: !this.state.isDropdownOpen
    });
  };

  render() {
    const { isDropdownOpen } = this.state;

    const Toggle = (
      <DropdownToggle onToggle={this.onDropdownToggle} iconComponent={null}>
        <QuestionCircleIcon />
      </DropdownToggle>
    );

    return (
      <>
        <AboutUIModal ref={this.about} status={this.props.status} components={this.props.components} />
        <DebugInformationContainer ref={this.debugInformation} />
        <Dropdown
          isPlain={true}
          position="right"
          onSelect={this.onDropdownSelect}
          isOpen={isDropdownOpen}
          toggle={Toggle}
          dropdownItems={[
            <DropdownItem component={'span'} key={'view_debug_info'} onClick={this.openDebugInformation}>
              View Debug Info
            </DropdownItem>,
            <DropdownItem component={'span'} key={'view_about_info'} onClick={this.openAbout}>
              About
            </DropdownItem>
          ]}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  components: state.statusState.components,
  warningMessages: state.statusState.warningMessages
});

const HelpDropdown = connect(mapStateToProps)(HelpDropdownContainer);
export default HelpDropdown;
