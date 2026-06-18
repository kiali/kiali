import { Alert, Tab, Tabs, TabTitleIcon, TabTitleText } from '@patternfly/react-core';
import * as React from 'react';
import { ChatSessionUsage } from './ChatSessionUsage';
import { AIStats } from './AIStats';
import { TachometerAltIcon, UserAltIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';

const pageStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflow: 'auto'
});

const tabContentStyle = kialiStyle({
  overflow: 'auto',
  padding: 'var(--pf-t--global--spacer--md)'
});

/**
 * Catches render errors from AIStats (e.g. Victory chart assertion failures on hover)
 * so they don't propagate to RenderPage's error boundary and replace the entire page.
 */
class AIStatsErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[AIStats] Chart render error:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <Alert variant="danger" title="Chart render error" style={{ margin: '1rem' }}>
          {this.state.error.message}
        </Alert>
      );
    }
    return this.props.children;
  }
}

export const AIDashboardPage: React.FC = () => {
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);

  return (
    <div className={pageStyle}>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(_e, key) => setActiveTabKey(key)}
        aria-label="AI Dashboard tabs"
        role="region"
      >
        <Tab
          eventKey={0}
          title={
            <>
              <TabTitleIcon>
                <TachometerAltIcon />
              </TabTitleIcon>
              <TabTitleText>Dashboard</TabTitleText>
            </>
          }
          aria-label="Dashboard tab"
        >
          <div className={tabContentStyle}>
            <AIStatsErrorBoundary>
              <AIStats />
            </AIStatsErrorBoundary>
          </div>
        </Tab>
        <Tab
          eventKey={1}
          title={
            <>
              <TabTitleIcon>
                <UserAltIcon />
              </TabTitleIcon>
              <TabTitleText>Session Usage</TabTitleText>
            </>
          }
          aria-label="Session Usage tab"
        >
          <div className={tabContentStyle}>
            <ChatSessionUsage />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};
