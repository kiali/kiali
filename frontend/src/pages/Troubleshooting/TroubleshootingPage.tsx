import * as React from 'react';
import { classes } from 'typestyle';
import { AITroubleshooting } from './AITroubleshooting';
import { flexFillStyle } from 'styles/FlexStyles';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';

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

export const TroubleshootingPage: React.FC = () => (
  <div className={classes(flexFillStyle, pageStyle)} data-test="troubleshooting-page">
    <div className={contentStyle}>
      <AITroubleshooting />
    </div>
  </div>
);
