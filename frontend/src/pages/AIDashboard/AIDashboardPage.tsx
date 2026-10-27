import { Tab, Tabs, TabTitleIcon, TabTitleText, Title, TitleSizes } from '@patternfly/react-core';
import * as React from 'react';
import { classes } from 'typestyle';
import { AIUsage } from './AIUsage';
import { TenantIcon, UserAltIcon, WrenchIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { flexFillStyle, noShrinkStyle } from 'styles/FlexStyles';
import { basicTabStyle } from 'styles/TabStyles';
import { useSelector } from 'react-redux';
import { location } from 'app/History';
import { useKialiDispatch } from 'hooks/redux';
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

const troubleshootingPaneStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  padding: PFSpacer.md
});

const pageTitleStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: PFSpacer.sm,
  marginBottom: PFSpacer.md,
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md,
  paddingTop: PFSpacer.md
});

const TAB_CONSUMPTION = 'consumption';
const TAB_SESSION_USAGE = 'session-usage';
const TAB_TROUBLESHOOTING = 'troubleshooting';

function troubleshootingTabVisible(aiConfig: KialiAppState['ai']): boolean {
  return !!(aiConfig.troubleshooting?.enabled && aiConfig.troubleshooting.allowed);
}

/** Metrics on (consumption.enabled) and user may open the cluster consumption tab (consumption.allowed). */
function showConsumptionDashboard(aiConfig: KialiAppState['ai']): boolean {
  return !!(aiConfig.consumption?.enabled && aiConfig.consumption.allowed);
}

function getVisibleTabKeys(aiConfig: KialiAppState['ai']): string[] {
  const keys: string[] = [];
  if (troubleshootingTabVisible(aiConfig)) {
    keys.push(TAB_TROUBLESHOOTING);
  }
  keys.push(TAB_SESSION_USAGE);
  if (showConsumptionDashboard(aiConfig)) {
    keys.push(TAB_CONSUMPTION);
  }
  return keys;
}

const tabFromLocation = (keys: string[]): string => {
  const requested = new URLSearchParams(location.getSearch()).get('tab');
  if (requested && keys.includes(requested)) {
    return requested;
  }
  return keys[0] ?? TAB_SESSION_USAGE;
};

export const AIDashboardPage: React.FC = () => {
  const dispatch = useKialiDispatch();
  const aiConfig = useSelector((state: KialiAppState) => state.ai);
  const visibleTabKeys = React.useMemo(() => getVisibleTabKeys(aiConfig), [aiConfig]);
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(() => tabFromLocation(visibleTabKeys));
  const scanRequested = React.useRef(false);
  const adminView = React.useMemo(() => showConsumptionDashboard(aiConfig), [aiConfig]);
  const showTroubleshooting = troubleshootingTabVisible(aiConfig);
  const showTabs = adminView || showTroubleshooting;

  React.useEffect(() => {
    if (!visibleTabKeys.includes(String(activeTabKey))) {
      setActiveTabKey(visibleTabKeys[0] ?? TAB_SESSION_USAGE);
    }
  }, [activeTabKey, visibleTabKeys]);

  React.useEffect(() => {
    if (!showTroubleshooting || scanRequested.current) {
      return;
    }
    scanRequested.current = true;
    // The troubleshooting tab loads the scan when it mounts. Request it here when
    // the dashboard opens on another tab so the shared Redux scan stays current.
    if (activeTabKey === TAB_TROUBLESHOOTING) {
      return;
    }
    void loadTroubleshootingScan(dispatch);
  }, [activeTabKey, dispatch, showTroubleshooting]);

  return (
    <div className={flexFillStyle}>
      {!showTabs ? (
        <>
          <Title
            className={classes(pageTitleStyle, noShrinkStyle)}
            data-test="ai-user-usage-title"
            headingLevel="h1"
            size={TitleSizes['2xl']}
          >
            <UserAltIcon /> {t('AI User Usage')}
          </Title>
          <div className={tabContentStyle}>
            <AIUsage />
          </div>
        </>
      ) : (
        <div className={classes(flexFillStyle, basicTabStyle)}>
          <Tabs
            activeKey={activeTabKey}
            onSelect={(_e, key) => setActiveTabKey(key)}
            aria-label={t('AI Dashboard tabs')}
            role="region"
          >
            {showTroubleshooting && (
              <Tab
                eventKey={TAB_TROUBLESHOOTING}
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
                  <div className={troubleshootingPaneStyle}>
                    <AITroubleshooting />
                  </div>
                )}
              </Tab>
            )}
            <Tab
              eventKey={TAB_SESSION_USAGE}
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
            <Tab
              eventKey={TAB_CONSUMPTION}
              title={
                <>
                  <TabTitleIcon>
                    <TenantIcon />
                  </TabTitleIcon>
                  <TabTitleText>{t('Consumption')}</TabTitleText>
                </>
              }
              aria-label={t('Consumption tab')}
            >
              {activeTabKey === TAB_CONSUMPTION && (
                <div className={tabContentStyle}>
                  <AIConsumption />
                </div>
              )}
            </Tab>
          </Tabs>
        </div>
      )}
    </div>
  );
};
