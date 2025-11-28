import { kialiStyle } from './StyleUtils';

export const globalStyle = kialiStyle({
  height: '100%',
  margin: 0,
  fontFamily: 'var(--pf-t--global--font--family--body)',
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
        '& tr > *': {
          paddingBottom: '0.5rem',
          paddingTop: '0.5rem'
        }
      }
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
      color:
        'var(pf-t--global--text--color--link--default)' /* CODEMODS: original v5 color was --pf-v5-global--link--Color--light */,
      $nest: {
        '&:hover': {
          color:
            'var(pf-t--global--text--color--link--hover)' /* CODEMODS: original v5 color was --pf-v5-global--link--Color--light--hover */
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
