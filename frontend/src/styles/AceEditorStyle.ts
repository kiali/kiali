import { PFColors } from 'components/Pf/PfColors';
import { NestedCSSProperties } from 'typestyle/lib/types';
import { kialiStyle } from './StyleUtils';

export const istioAceEditorStyle = kialiStyle({
  minHeight: '200px',
  position: 'relative',
  border: `1px solid ${PFColors.BorderColor200}`,
  fontSize: 'var(--kiali-global--font-size) !important',
  $nest: {
    '& div.ace_gutter-cell.ace_info': {
      backgroundImage: 'none',
      $nest: {
        '&::before': {
          content: `'\\E92b'`,
          fontFamily: 'pf-v6-pficon',
          left: '5px',
          position: 'absolute'
        }
      }
    },
    // annotation tooltips should appear above menu and drawer
    '& .ace_tooltip': {
      zIndex: '1000 !important',
      maxWidth: '800px',
      wordWrap: 'break-word',
      whiteSpace: 'normal'
    }
  }
} as NestedCSSProperties);

// Specific z-index for drawer panel for the context tooltip
export const drawerPanelStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-drawer__panel': {
      zIndex: 90
    }
  }
} as NestedCSSProperties);

export const istioValidationErrorStyle = kialiStyle({
  position: 'absolute'
  // Removing colors due PF6 dark mode changes
  //background: 'rgba(204, 0, 0, 0.5)'
});

export const istioValidationWarningStyle = kialiStyle({
  position: 'absolute'
  // Removing colors due PF6 dark mode changes
  //background: 'rgba(236, 122, 8, 0.5)'
});

export const istioValidationInfoStyle = kialiStyle({
  position: 'absolute'
  // Removing colors due PF6 dark mode changes
  //background: PFColors.ColorLight300
});
