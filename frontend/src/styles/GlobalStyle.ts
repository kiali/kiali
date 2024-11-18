import { kialiStyle } from './StyleUtils';

export const globalStyle = kialiStyle({
  height: '100%',
  margin: 0,
  padding: 0,
  fontFamily: 'var(--pf-v5-global--FontFamily--text)',
  fontSize: '14px',
  overflow: 'hidden',
  $nest: {
    /**
     * Kiosk mode (hide Kiali menu)
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
     * Reduce padding of menu group title
     */
    '& .pf-v5-c-menu__group-title': {
      paddingTop: '0.5rem'
    },

    /**
     * Padding for table rows
     */
    '& .pf-v5-c-table': {
      $nest: {
        '&.pf-m-compact tr > *': {
          padding: '0.5rem'
        },
        '& tr > *': {
          paddingBottom: '0.5rem',
          paddingTop: '0.5rem'
        }
      }
    },

    /**
     * Show graph legend
     */
    '& .pf-v5-c-chart svg': {
      overflow: 'visible'
    },

    /**
     * Light color for links in tooltips
     */
    '& .pf-v5-c-tooltip a': {
      color: 'var(--pf-v5-global--link--Color--light)',
      $nest: {
        '&:hover': {
          color: 'var(--pf-v5-global--link--Color--light--hover)'
        }
      }
    },

    /**
     * Hide the kebab menu of Patternfly topology groups
     * TODO Remove when groups can hide the kebab menu - https://github.com/patternfly/react-topology/issues/254
     */
    '& #pft-graph .pf-topology__group__label': {
      $nest: {
        '& .pf-topology__node__label__badge ~ text:not(.pf-m-secondary)': {
          transform: 'translateX(10px)'
        },
        '& .pf-topology__node__action-icon': {
          visibility: 'hidden'
        },
        '& text ~ .pf-topology__node__separator': {
          visibility: 'hidden'
        }
      }
    },

    /**
     * TODO Move to labelClassName - https://github.com/patternfly/react-topology/issues/255
     */
    '& #mesh-container .pf-topology__group__label': {
      $nest: {
        '& > text': {
          fontSize: '1.25rem'
        },
        '& .pf-topology__node__label__badge > text': {
          fontSize: '1rem'
        }
      }
    }
  }
});
