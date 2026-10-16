import { Tab, Tabs, TabTitleIcon, TabTitleText, Title, TitleSizes } from '@patternfly/react-core';
import * as React from 'react';
import { classes } from 'typestyle';
import { AIUsage } from './AIUsage';
import { TenantIcon, UserAltIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { flexFillStyle, noShrinkStyle } from 'styles/FlexStyles';
import { basicTabStyle } from 'styles/TabStyles';
import { useSelector } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import { t } from 'utils/I18nUtils';
import { AIConsumption } from './AIConsumption/AIConsumption';

const tabContentStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
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

/** Metrics on (consumption.enabled) and user may open the cluster consumption tab (consumption.allowed). */
function showConsumptionDashboard(aiConfig: KialiAppState['ai']): boolean {
  return !!(aiConfig.consumption?.enabled && aiConfig.consumption.allowed);
}

function getVisibleTabKeys(aiConfig: KialiAppState['ai']): string[] {
  const keys: string[] = [TAB_SESSION_USAGE];
  if (showConsumptionDashboard(aiConfig)) {
    keys.push(TAB_CONSUMPTION);
  }
  return keys;
}

export const AIDashboardPage: React.FC = () => {
  const aiConfig = useSelector((state: KialiAppState) => state.ai);
  const visibleTabKeys = React.useMemo(() => getVisibleTabKeys(aiConfig), [aiConfig]);
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(TAB_SESSION_USAGE);
  const adminView = React.useMemo(() => showConsumptionDashboard(aiConfig), [aiConfig]);

  React.useEffect(() => {
    if (!visibleTabKeys.includes(String(activeTabKey))) {
      setActiveTabKey(TAB_SESSION_USAGE);
    }
  }, [activeTabKey, visibleTabKeys]);

  return (
    <div className={flexFillStyle}>
      {!adminView ? (
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
