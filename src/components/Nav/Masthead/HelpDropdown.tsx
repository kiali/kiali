import * as React from 'react';
import AboutUIModal from '../../About/AboutUIModal';
import { KialiAppState } from '../../../store/Store';
import DebugInformationContainer from '../../../components/DebugInformation/DebugInformation';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';
import { isUpstream } from '../../UpstreamDetector/UpstreamDetector';
import { Status, Component, StatusKey } from '../../../types/StatusState';
import { config } from '../../../config';

type HelpDropdownProps = {
  status: Status;
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

  openAbout = () => {
    this.about.current!.open();
  };

  openDebugInformation = () => {
    // Using wrapped component, so we have to get the wrappedInstance
    this.debugInformation.current!.open();
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

  buildDocumentationLink() {
    const url = new URL(config.documentation.url);
    if (isUpstream) {
      const kialiCoreVersion = this.props.status[StatusKey.KIALI_CORE_VERSION] || 'unknown';

      url.searchParams.append('utm_source', 'kiali');
      url.searchParams.append('utm_medium', 'app');
      url.searchParams.append('utm_campaign', kialiCoreVersion);
      url.searchParams.append('utm_content', '?-menu');
    }
    return url.toString();
  }

  render() {
    const { isDropdownOpen } = this.state;

    const Toggle = (
      <DropdownToggle onToggle={this.onDropdownToggle} iconComponent={null} style={{ marginTop: 3 }}>
        <QuestionCircleIcon />
      </DropdownToggle>
    );

    const items = [
      <DropdownItem component={'a'} key={'view_documentation'} href={this.buildDocumentationLink()} target="_blank">
        Documentation
      </DropdownItem>,
      <DropdownItem component={'span'} key={'view_debug_info'} onClick={this.openDebugInformation}>
        View Debug Info
      </DropdownItem>,
      <DropdownItem component={'span'} key={'view_about_info'} onClick={this.openAbout}>
        About
      </DropdownItem>
    ];

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
          dropdownItems={items}
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
