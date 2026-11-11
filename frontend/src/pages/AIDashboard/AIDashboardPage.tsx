import { Tab, Tabs, TabTitleIcon, TabTitleText, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { classes } from 'typestyle';
import { AIUsage } from './AIUsage';
import { TenantIcon, UserAltIcon, WrenchIcon } from '@patternfly/react-icons';
import { Paths } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { flexFillStyle } from 'styles/FlexStyles';
import { basicTabStyle } from 'styles/TabStyles';
import { location } from 'app/History';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { loadTroubleshootingScan } from 'services/AiTroubleshooting';
import type { KialiAppState } from 'store/Store';
import { t } from 'utils/I18nUtils';
import { AIConsumption } from './AIConsumption/AIConsumption';
import { AITroubleshooting } from './AITroubleshooting/AITroubleshooting';

const tabContentStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: PFSpacer.md
});

const TAB_CONSUMPTION = 'consumption';
const TAB_SESSION_USAGE = 'session-usage';
const TAB_TROUBLESHOOTING = 'troubleshooting';

function troubleshootingTabVisible(aiConfig: KialiAppState['ai']): boolean {
  return !!aiConfig.enabled;
}

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
  if (troubleshootingTabVisible(aiConfig)) {
    keys.push(TAB_TROUBLESHOOTING);
  }
  if (sessionUsageTabVisible(aiConfig)) {
    keys.push(TAB_SESSION_USAGE);
  }
  // Only selectable when enabled and allowed; disabled tabs stay out of deep-link targets.
  if (consumptionTabEnabled(aiConfig) && consumptionTabAllowed(aiConfig)) {
    keys.push(TAB_CONSUMPTION);
  }
  return keys;
}

const tabFromLocation = (keys: string[]): string => {
  const requested = new URLSearchParams(location.getSearch()).get('tab');
  if (requested && keys.includes(requested)) {
    return requested;
  }
  return keys[0] ?? TAB_TROUBLESHOOTING;
};

export const AIDashboardPage: React.FC = () => {
  const dispatch = useKialiDispatch();
  const aiConfig = useKialiSelector(state => state.ai);
  const visibleTabKeys = React.useMemo(() => getVisibleTabKeys(aiConfig), [aiConfig]);
  const [selectedTabKey, setSelectedTabKey] = React.useState<string | number>(() => tabFromLocation(visibleTabKeys));
  const activeTabKey = visibleTabKeys.includes(String(selectedTabKey))
    ? selectedTabKey
    : (visibleTabKeys[0] ?? TAB_TROUBLESHOOTING);
  const scanRequestedRef = React.useRef(false);
  const showConsumptionTab = React.useMemo(() => consumptionTabEnabled(aiConfig), [aiConfig]);
  const consumptionAllowed = React.useMemo(() => consumptionTabAllowed(aiConfig), [aiConfig]);
  const showSessionUsage = React.useMemo(() => sessionUsageTabVisible(aiConfig), [aiConfig]);
  const showTroubleshooting = troubleshootingTabVisible(aiConfig);

  React.useEffect(() => {
    if (!aiConfig.enabled || !showTroubleshooting || scanRequestedRef.current) {
      return;
    }
    scanRequestedRef.current = true;
    // The troubleshooting tab loads the scan when it mounts. Request it here when
    // the dashboard opens on another tab so the shared Redux scan stays current.
    if (activeTabKey === TAB_TROUBLESHOOTING) {
      return;
    }
    void loadTroubleshootingScan(dispatch);
  }, [activeTabKey, aiConfig.enabled, dispatch, showTroubleshooting]);

  // Deep links to /ai are still reachable when the nav item is hidden.
  if (!aiConfig.enabled) {
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
        {showTroubleshooting && (
          <Tab
            eventKey={TAB_TROUBLESHOOTING}
            data-test="ai-dashboard-tab-troubleshooting"
            title={
              <>
                <TabTitleIcon>
                  <WrenchIcon />
                </TabTitleIcon>
                <TabTitleText>{t('Troubleshooting')}</TabTitleText>
              </>
            }
            aria-label={t('Troubleshooting tab')}
          >
            {activeTabKey === TAB_TROUBLESHOOTING && (
              <div className={tabContentStyle}>
                <AITroubleshooting />
              </div>
            )}
          </Tab>
        )}
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
