import * as React from 'react';
import { Label, Flex, FlexItem, Tooltip, Toolbar, ToolbarItem } from '@patternfly/react-core';

import { homeCluster, serverConfig } from '../../../config';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from './ThemeSwitch';
import { LanguageSwitch } from './LanguageSwitch';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';
import { PfSpinner } from 'components/Pf/PfSpinner';

export const MastheadItems: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <>
      <PfSpinner />
      <Toolbar>
        <ToolbarItem style={{ marginLeft: 'auto' }}>
          <Flex>
            <FlexItem align={{ default: 'alignRight' }}>
              {homeCluster?.name && (
                <Tooltip
                  entryDelay={0}
                  position="bottom"
                  content={<div>{t('Kiali home cluster: {{name}}', { name: homeCluster?.name })}</div>}
                >
                  <Label data-test="cluster-icon" color="blue" icon={<KialiIcon.Cluster />}>
                    {homeCluster?.name}
                  </Label>
                </Tooltip>
              )}
            </FlexItem>

            <FlexItem style={{ marginLeft: '1rem' }}>
              <ThemeSwitch />
            </FlexItem>

            <FlexItem>
              <IstioStatus location={'masthead'} />
            </FlexItem>

            <FlexItem style={{ marginRight: 0 }}>
              <MessageCenterTrigger />
            </FlexItem>

            <FlexItem style={{ marginRight: '0.75rem' }}>
              <HelpDropdown />
            </FlexItem>

            {serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector && (
              <FlexItem>
                <LanguageSwitch />
              </FlexItem>
            )}

            <FlexItem data-test="user-dropdown">
              <UserDropdown />
            </FlexItem>
          </Flex>
        </ToolbarItem>
      </Toolbar>
    </>
  );
};
