import { PFColors } from 'components/Pf/PfColors';
import { PF_THEME_DARK, Theme } from 'types/Common';
import { cssRule } from 'typestyle';
import { globalStyle } from './GlobalStyle';
import { kialiStyle } from './StyleUtils';

// Apply global dark theme styles
cssRule(`:where(.${PF_THEME_DARK}) .${globalStyle}`, {
  color: '#fff'
});

export const bgLight = kialiStyle({
  backgroundColor: PFColors.White
});

export const bgDark = kialiStyle({
  backgroundColor: PFColors.Black800
});

export const bgDarkMedium = kialiStyle({
  backgroundColor: PFColors.Black700
});

export const bgDarkSoft = kialiStyle({
  backgroundColor: PFColors.Black500
});

export const getGraphBackgroundStyle = (theme: string) => {
  return {
    backgroundColor: theme === Theme.Dark ? PFColors.Black700 : PFColors.White,
    color: theme === Theme.Dark ? PFColors.White : PFColors.Black700
  };
};
