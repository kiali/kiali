import * as React from 'react';
import { classes } from 'typestyle';
import { AIChatContext } from 'hooks/aiInteraction';
import type { OpenAIChatFn } from 'hooks/aiInteraction';
import { flexFillStyle } from 'styles/FlexStyles';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { AITroubleshooting } from './AITroubleshooting';

const pageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0
});

const contentStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingBottom: PFSpacer.md,
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md,
  paddingTop: 0
});

export type TroubleshootingPageProps = {
  /** When set, Ask / Fix actions open this chat (e.g. OpenShift Lightspeed) instead of the Kiali chatbot. */
  openAIChat?: OpenAIChatFn;
};

export const TroubleshootingPage: React.FC<TroubleshootingPageProps> = ({ openAIChat }) => (
  <AIChatContext.Provider value={openAIChat}>
    <div className={classes(flexFillStyle, pageStyle)} data-test="troubleshooting-page">
      <div className={contentStyle}>
        <AITroubleshooting />
      </div>
    </div>
  </AIChatContext.Provider>
);
