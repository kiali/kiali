import { PF_THEME_GLASS } from 'types/Common';

import { PFColors } from 'components/Pf/PfColors';
import { TABLE_SCROLLED } from 'components/Table/StickyTableScrollContainer';
import { kialiStyle } from './StyleUtils';

export const globalStyle = kialiStyle({
  height: '100%',
  margin: 0,
  fontFamily: 'var(--pf-t--global--font--family--body)',
  fontSize: '14px',
  overflow: 'hidden',
  $nest: {
    /**
     * Kiosk mode (hide Kiali menu and sidebar)
     */
    '&.kiosk': {
      $nest: {
        '& .pf-v6-c-page': {
          gridTemplateAreas: '"main"',
          gridTemplateColumns: '100%',
          gridTemplateRows: '100%'
        },

        '& .pf-v6-c-page__main-container': {
          height: '100%',
          margin: '0.5rem 1rem'
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
     * Drawer panels should have less z-index than dropdowns
     */
    '& .pf-v6-c-drawer__panel': {
      zIndex: 199
    },

    /**
     * Reduce padding of menu group title
     */
    '& .pf-v6-c-menu__group-title': {
      paddingTop: '0.5rem'
    },

    /**
     * Padding for table rows
     */
    '& .pf-v6-c-table': {
      $nest: {
        '&.pf-m-compact tr > *': {
          padding: '0.5rem'
        },
        '&.pf-m-compact thead tr > *': {
          paddingTop: 0
        },
        '& tr > *': {
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        '& thead tr > *': {
          paddingTop: 0
        }
      }
    },

    /**
     * Under OpenShift glass, clear PF sticky-header elevation (thead::after). Header
     * cells stay transparent at rest; StickyTableScrollContainer adds
     * TABLE_SCROLLED while scrolling to apply an opaque sticky fill.
     */
    [`html.${PF_THEME_GLASS} & .pf-v6-c-table > .pf-v6-c-table__thead::after`]: {
      boxShadow: 'none'
    },
    [`html.${PF_THEME_GLASS} & .pf-v6-c-table > .pf-v6-c-table__thead .pf-v6-c-table__th::after`]: {
      backgroundColor: 'transparent'
    },
    [`html.${PF_THEME_GLASS} & .${TABLE_SCROLLED} .pf-v6-c-table > .pf-v6-c-table__thead .pf-v6-c-table__th::after`]: {
      backgroundColor: PFColors.BackgroundColorSticky
    },

    /**
     * ChatBot docked mode should fit within the page drawer height
     */
    '& .pf-chatbot--docked': {
      height: 'var(--kiali-chatbot-docked-height, 95vh) !important',
      maxHeight: 'var(--kiali-chatbot-docked-height, 95vh) !important'
    },

    '& .pf-chatbot--fullscreen': {
      height: 'var(--kiali-chatbot-fullscreen-height, 95vh) !important',
      width: 'var(--kiali-chatbot-fullscreen-width, 95vw) !important',
      maxHeight: 'var(--kiali-chatbot-fullscreen-height, 95vh) !important',
      maxWidth: 'var(--kiali-chatbot-fullscreen-width, 95vw) !important'
    },

    /**
     * Show graph legend
     */
    '& .pf-v6-c-chart svg': {
      overflow: 'visible'
    },

    /**
     * Light color for links in tooltips
     */
    '& .pf-v6-c-tooltip a': {
      color: 'var(pf-t--global--text--color--link--default)',
      $nest: {
        '&:hover': {
          color: 'var(pf-t--global--text--color--link--hover)'
        }
      }
    },

    /**
     * Remove underline from links
     */
    '& a': {
      textDecoration: 'none'
    },

    /**
     * Remove color override for content in Cluster badge tooltip
     */
    '& .pf-v6-c-content, & .pf-v6-c-content > h4': {
      color: 'unset'
    }
  }
});
