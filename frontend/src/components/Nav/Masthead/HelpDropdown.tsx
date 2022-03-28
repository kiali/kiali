import * as React from 'react';
import AboutUIModal from '../../About/AboutUIModal';
import { KialiAppState } from '../../../store/Store';
import DebugInformationContainer from '../../../components/DebugInformation/DebugInformation';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';
import { isUpstream } from '../../UpstreamDetector/UpstreamDetector';
import { Status, ExternalServiceInfo, StatusKey } from '../../../types/StatusState';
import { config, serverConfig } from '../../../config';
import IstioCertsInfoConnected from 'components/IstioCertsInfo/IstioCertsInfo';

type HelpDropdownProps = {
  status: Status;
  externalServices: ExternalServiceInfo[];
  warningMessages: string[];
};

interface HelpDropdownState {
  isDropdownOpen: boolean;
}

class HelpDropdownContainer extends React.Component<HelpDropdownProps, HelpDropdownState> {
  about: React.RefObject<AboutUIModal>;
  debugInformation: React.RefObject<any>;
  certsInformation: React.RefObject<any>;

  constructor(props: HelpDropdownProps) {
    super(props);
    this.state = { isDropdownOpen: false };
    this.about = React.createRef<AboutUIModal>();
    this.debugInformation = React.createRef();
    this.certsInformation = React.createRef();
  }

  openAbout = () => {
    this.about.current!.open();
  };

  openDebugInformation = () => {
    // Using wrapped component, so we have to get the wrappedInstance
    this.debugInformation.current!.open();
  };

  openCertsInformation = () => {
    this.certsInformation.current!.open();
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
      <DropdownToggle onToggle={this.onDropdownToggle} style={{ marginTop: 3 }}>
        <QuestionCircleIcon />
      </DropdownToggle>
    );

    const items: JSX.Element[] = [];

    items.push(
      <DropdownItem component={'a'} key={'view_documentation'} href={this.buildDocumentationLink()} target="_blank">
        Documentation
      </DropdownItem>
    );

    items.push(
      <DropdownItem component={'span'} key={'view_debug_info'} onClick={this.openDebugInformation}>
        View Debug Info
      </DropdownItem>
    );

    if (serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled) {
      items.push(
        <DropdownItem component={'span'} key={'view_certs_info'} onClick={this.openCertsInformation}>
          View Certificates Info
        </DropdownItem>
      );
    }

    items.push(
      <DropdownItem component={'span'} key={'view_about_info'} onClick={this.openAbout}>
        About
      </DropdownItem>
    );

    return (
      <>
        <AboutUIModal ref={this.about} status={this.props.status} externalServices={this.props.externalServices} />
        <DebugInformationContainer ref={this.debugInformation} />
        {serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled && (
          <IstioCertsInfoConnected ref={this.certsInformation} />
        )}
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
  externalServices: state.statusState.externalServices,
  warningMessages: state.statusState.warningMessages
});

const HelpDropdown = connect(mapStateToProps)(HelpDropdownContainer);
export default HelpDropdown;
