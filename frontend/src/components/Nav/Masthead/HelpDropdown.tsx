import * as React from 'react';
import { AboutUIModal } from '../../About/AboutUIModal';
import { KialiAppState } from '../../../store/Store';
import { DebugInformation } from '../../../components/DebugInformation/DebugInformation';
import { QuestionCircleIcon } from '@patternfly/react-icons/';
import { connect } from 'react-redux';
import { isUpstream } from '../../UpstreamDetector/UpstreamDetector';
import { Status, StatusKey } from '../../../types/StatusState';
import { config } from '../../../config';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  status: Status;
  warningMessages: string[];
};

type HelpDropdownProps = ReduxProps;

const HelpDropdownComponent: React.FC<HelpDropdownProps> = (props: HelpDropdownProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState<boolean>(false);
  const [isDebugInformationOpen, setIsDebugInformationOpen] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const onDropdownSelect = (): void => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const buildDocumentationLink = (): string => {
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

  const items: React.ReactNode[] = [];

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

      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            data-test="about-help-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label={t('Help')}
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

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  status: state.statusState.status,
  warningMessages: state.statusState.warningMessages
});

export const HelpDropdown = connect(mapStateToProps)(HelpDropdownComponent);
