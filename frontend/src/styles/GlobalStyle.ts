import { kialiStyle } from './StyleUtils';

export const globalStyle = kialiStyle({
  height: '100%',
  margin: 0,
  padding: 0,
  // TODO: possible change to --pf-v5-global--FontFamily--redhat-updated--sans-serif
  fontFamily: 'var(--pf-v5-global--FontFamily--text)',
  fontSize: '14px',
  overflow: 'hidden',
  $nest: {
    /**
     * Kiosk mode
     */
    '&.kiosk': {
      $nest: {
        '& #page-sidebar': {
          display: 'none'
        },

        '& header[role="kiali_header"]': {
          display: 'none'
        }
      }
    },

    '& #root': {
      height: '100%'
    },

    '& img': {
      verticalAlign: 'middle'
    },

    /**
     * Remove global page padding by default
     */
    '& .pf-v5-c-page__main-section': {
      padding: 0,
      height: '100%',
      overflowY: 'hidden'
    },

    /**
     * Drawer panels should have less z-index than dropdowns
     */
    '& .pf-v5-c-drawer__panel': {
      zIndex: 199
    },

    /**
     * Health SVG visible
     */
    // eslint-disable-next-line no-multi-str
    '& svg:not(:root).icon-failure, \
     & svg:not(:root).icon-degraded, \
     & svg:not(:root).icon-healthy, \
     & svg:not(:root).icon-na': {
      overflow: 'visible'
    },

    /**
     * Padding for table rows
     */
    '& .pf-v5-c-table tr > *': {
      paddingBottom: '0.5rem',
      paddingTop: '0.5rem'
    },

    '& .pf-v5-c-chart svg': {
      overflow: 'visible !important'
    }
  }
});
