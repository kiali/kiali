import * as React from 'react';
import { AboutUIModal } from '../../About/AboutUIModal';
import { KialiAppState } from '../../../store/Store';
import { DebugInformation } from '../../../components/DebugInformation/DebugInformation';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core/deprecated';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';
import { isUpstream } from '../../UpstreamDetector/UpstreamDetector';
import { Status, ExternalServiceInfo, StatusKey } from '../../../types/StatusState';
import { config, serverConfig } from '../../../config';
import { IstioCertsInfo } from 'components/IstioCertsInfo/IstioCertsInfo';
import { kialiStyle } from 'styles/StyleUtils';

type HelpDropdownProps = {
  status: Status;
  externalServices: ExternalServiceInfo[];
  warningMessages: string[];
};

const dropdownItemStyle = kialiStyle({
  cursor: 'pointer'
});

const HelpDropdownComponent: React.FC<HelpDropdownProps> = (props: HelpDropdownProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState<boolean>(false);
  const [isDebugInformationOpen, setIsDebugInformationOpen] = React.useState<boolean>(false);
  const [isCertsInformationOpen, setIsCertsInformationOpen] = React.useState<boolean>(false);

  const onDropdownSelect = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const buildDocumentationLink = () => {
    const url = new URL(config.documentation.url);
    if (isUpstream) {
      const kialiCoreVersion = props.status[StatusKey.KIALI_CORE_VERSION] || 'unknown';

      url.searchParams.append('utm_source', 'kiali');
      url.searchParams.append('utm_medium', 'app');
      url.searchParams.append('utm_campaign', kialiCoreVersion);
      url.searchParams.append('utm_content', '?-menu');
    }
    return url.toString();
  };

  const Toggle = (
    <DropdownToggle
      toggleIndicator={null}
      onToggle={(_event, isDropdownOpen) => setIsDropdownOpen(isDropdownOpen)}
      aria-label="Help"
      style={{ marginTop: 3, verticalAlign: '-0.1em' }}
    >
      <QuestionCircleIcon />
    </DropdownToggle>
  );

  const items: JSX.Element[] = [];

  items.push(
    <DropdownItem component={'a'} key={'view_documentation'} href={buildDocumentationLink()} target="_blank">
      Documentation
    </DropdownItem>
  );

  items.push(
    <DropdownItem
      component={'span'}
      key={'view_debug_info'}
      onClick={() => setIsDebugInformationOpen(true)}
      className={dropdownItemStyle}
    >
      View Debug Info
    </DropdownItem>
  );

  if (serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled) {
    items.push(
      <DropdownItem
        component={'span'}
        key={'view_certs_info'}
        onClick={() => setIsCertsInformationOpen(true)}
        className={dropdownItemStyle}
      >
        View Certificates Info
      </DropdownItem>
    );
  }

  items.push(
    <DropdownItem
      component={'span'}
      key={'view_about_info'}
      onClick={() => setIsAboutModalOpen(true)}
      className={dropdownItemStyle}
    >
      About
    </DropdownItem>
  );

  return (
    <>
      <AboutUIModal
        status={props.status}
        externalServices={props.externalServices}
        warningMessages={props.warningMessages}
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
      <DebugInformation isOpen={isDebugInformationOpen} onClose={() => setIsDebugInformationOpen(false)} />
      {serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled && (
        <IstioCertsInfo isOpen={isCertsInformationOpen} onClose={() => setIsCertsInformationOpen(false)} />
      )}
      <Dropdown
        data-test="about-help-button"
        isPlain={true}
        position="right"
        onSelect={onDropdownSelect}
        isOpen={isDropdownOpen}
        toggle={Toggle}
        dropdownItems={items}
      />
    </>
  );
};

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  externalServices: state.statusState.externalServices,
  warningMessages: state.statusState.warningMessages
});

export const HelpDropdown = connect(mapStateToProps)(HelpDropdownComponent);
