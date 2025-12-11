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
