import * as React from 'react';
import { AboutUIModal } from '../../About/AboutUIModal';
import { KialiAppState } from '../../../store/Store';
import { DebugInformation } from '../../../components/DebugInformation/DebugInformation';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';
import { isUpstream } from '../../UpstreamDetector/UpstreamDetector';
import { Status, StatusKey } from '../../../types/StatusState';
import { config, serverConfig } from '../../../config';
import { IstioCertsInfo } from 'components/IstioCertsInfo/IstioCertsInfo';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';

type HelpDropdownReduxProps = {
  status: Status;
  warningMessages: string[];
};

type HelpDropdownProps = HelpDropdownReduxProps & {};

const menuToggleStyle = kialiStyle({
  marginTop: '0.25rem',
  verticalAlign: '-0.1rem'
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

  const items: JSX.Element[] = [];

  items.push(
    <DropdownItem key={'view_documentation'} onClick={() => window.open(buildDocumentationLink(), '_blank')}>
      Documentation
    </DropdownItem>
  );

  items.push(
    <DropdownItem key={'view_debug_info'} onClick={() => setIsDebugInformationOpen(true)}>
      View Debug Info
    </DropdownItem>
  );

  if (serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled) {
    items.push(
      <DropdownItem key={'view_certs_info'} onClick={() => setIsCertsInformationOpen(true)}>
        View Certificates Info
      </DropdownItem>
    );
  }

  items.push(
    <DropdownItem key={'view_about_info'} onClick={() => setIsAboutModalOpen(true)}>
      About
    </DropdownItem>
  );

  return (
    <>
      <AboutUIModal
        status={props.status}
        warningMessages={props.warningMessages}
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      <DebugInformation isOpen={isDebugInformationOpen} onClose={() => setIsDebugInformationOpen(false)} />

      {serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled && (
        <IstioCertsInfo isOpen={isCertsInformationOpen} onClose={() => setIsCertsInformationOpen(false)} />
      )}

      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            className={menuToggleStyle}
            data-test="about-help-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="Help"
            variant="plain"
            isExpanded={isDropdownOpen}
          >
            <QuestionCircleIcon />
          </MenuToggle>
        )}
        isOpen={isDropdownOpen}
        popperProps={{ position: 'right' }}
        onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
        onSelect={onDropdownSelect}
      >
        <DropdownList>{items}</DropdownList>
      </Dropdown>
    </>
  );
};

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  warningMessages: state.statusState.warningMessages
});

export const HelpDropdown = connect(mapStateToProps)(HelpDropdownComponent);
