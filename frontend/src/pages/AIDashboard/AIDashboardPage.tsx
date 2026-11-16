import { Tab, Tabs, TabTitleIcon, TabTitleText, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { classes } from 'typestyle';
import { AIUsage } from './AIUsage';
import { TenantIcon, UserAltIcon } from '@patternfly/react-icons';
import { Paths } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { flexFillStyle } from 'styles/FlexStyles';
import { basicTabStyle } from 'styles/TabStyles';
import { location } from 'app/History';
import { useKialiSelector } from 'hooks/redux';
import type { KialiAppState } from 'store/Store';
import { t } from 'utils/I18nUtils';
import { AIConsumption } from './AIConsumption/AIConsumption';

const tabContentStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: PFSpacer.md
});

const TAB_CONSUMPTION = 'consumption';
const TAB_SESSION_USAGE = 'session-usage';

/** Session usage is only meaningful when Chat AI is configured on. */
function sessionUsageTabVisible(aiConfig: KialiAppState['ai']): boolean {
  return !!aiConfig.enabled && !!aiConfig.chat?.enabled;
}

/** Consumption metrics feature is configured on. */
function consumptionTabEnabled(aiConfig: KialiAppState['ai']): boolean {
  return !!aiConfig.consumption?.enabled;
}

/** User may open the cluster consumption tab. */
function consumptionTabAllowed(aiConfig: KialiAppState['ai']): boolean {
  return !!aiConfig.consumption?.allowed;
}

function getVisibleTabKeys(aiConfig: KialiAppState['ai']): string[] {
  const keys: string[] = [];
  if (sessionUsageTabVisible(aiConfig)) {
    keys.push(TAB_SESSION_USAGE);
  }
  // Keep the tab visible when the feature is on even if the user is not allowed
  // (aria-disabled + tooltip). Excluding it here would empty the page and redirect.
  if (consumptionTabEnabled(aiConfig)) {
    keys.push(TAB_CONSUMPTION);
  }
  return keys;
}

/** Tabs that may be selected / deep-linked (excludes allow-list denials). */
function getSelectableTabKeys(aiConfig: KialiAppState['ai']): string[] {
  return getVisibleTabKeys(aiConfig).filter(key => {
    if (key === TAB_CONSUMPTION) {
      return consumptionTabAllowed(aiConfig);
    }
    return true;
  });
}

const tabFromLocation = (keys: string[]): string => {
  const requested = new URLSearchParams(location.getSearch()).get('tab');
  if (requested && keys.includes(requested)) {
    return requested;
  }
  return keys[0] ?? TAB_SESSION_USAGE;
};

export const AIDashboardPage: React.FC = () => {
  const aiConfig = useKialiSelector(state => state.ai);
  const visibleTabKeys = React.useMemo(() => getVisibleTabKeys(aiConfig), [aiConfig]);
  const selectableTabKeys = React.useMemo(() => getSelectableTabKeys(aiConfig), [aiConfig]);
  // Prefer an allowed tab for deep links; fall back to the first visible tab (may be aria-disabled).
  const [selectedTabKey, setSelectedTabKey] = React.useState<string | number>(() =>
    tabFromLocation(selectableTabKeys.length > 0 ? selectableTabKeys : visibleTabKeys)
  );
  const activeTabKey = visibleTabKeys.includes(String(selectedTabKey))
    ? selectedTabKey
    : (visibleTabKeys[0] ?? TAB_SESSION_USAGE);
  const showConsumptionTab = React.useMemo(() => consumptionTabEnabled(aiConfig), [aiConfig]);
  const consumptionAllowed = React.useMemo(() => consumptionTabAllowed(aiConfig), [aiConfig]);
  const showSessionUsage = React.useMemo(() => sessionUsageTabVisible(aiConfig), [aiConfig]);

  // Legacy deep link from when Troubleshooting lived under the AI Dashboard.
  const requestedTab = new URLSearchParams(location.getSearch()).get('tab');
  if (requestedTab === 'troubleshooting') {
    return <Navigate to={`/${Paths.TROUBLESHOOTING}`} replace />;
  }

  // Deep links to /ai are still reachable when the nav item is hidden.
  // With no chat/consumption tabs there is nothing to show on this page.
  if (!aiConfig.enabled || visibleTabKeys.length === 0) {
    return <Navigate to={`/${Paths.OVERVIEW}`} replace />;
  }

  return (
    <div className={classes(flexFillStyle, basicTabStyle)}>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(_e, key) => setSelectedTabKey(key)}
        aria-label={t('AI Dashboard tabs')}
        role="region"
      >
        {showSessionUsage && (
          <Tab
            eventKey={TAB_SESSION_USAGE}
            data-test="ai-dashboard-tab-session-usage"
            title={
              <>
                <TabTitleIcon>
                  <UserAltIcon />
                </TabTitleIcon>
                <TabTitleText>{t('AI User Usage')}</TabTitleText>
              </>
            }
            aria-label={t('AI User Usage tab')}
          >
            {activeTabKey === TAB_SESSION_USAGE && (
              <div className={tabContentStyle}>
                <AIUsage />
              </div>
            )}
          </Tab>
        )}
        {showConsumptionTab && (
          <Tab
            eventKey={TAB_CONSUMPTION}
            data-test="ai-dashboard-tab-consumption"
            isAriaDisabled={!consumptionAllowed}
            title={
              <>
                <TabTitleIcon>
                  <TenantIcon />
                </TabTitleIcon>
                <TabTitleText>{t('Consumption')}</TabTitleText>
              </>
            }
            aria-label={t('Consumption tab')}
            tooltip={
              !consumptionAllowed ? <Tooltip content={t('Consumption is not allowed for this user')} /> : undefined
            }
          >
            {activeTabKey === TAB_CONSUMPTION && consumptionAllowed && (
              <div className={tabContentStyle}>
                <AIConsumption />
              </div>
            )}
          </Tab>
        )}
      </Tabs>
    </div>
  );
};
