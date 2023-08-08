import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const globalStyle = kialiStyle({
  height: '100%',
  margin: 0,
  padding: 0,
  // TODO: possible change to --pf-global--FontFamily--redhat-updated--sans-serif
  fontFamily: 'var(--pf-global--FontFamily--sans-serif)',
  fontSize: '14px',
  overflow: 'hidden',
  $nest: {
    /**
     * Kiosk mode
     */
    '&.kiosk': {
      $nest: {
        '#page-sidebar': {
          display: 'none'
        },

        'header[role="kiali_header"]': {
          display: 'none'
        }
      }
    },

    '#root': {
      height: '100%'
    },

    img: {
      verticalAlign: 'middle'
    },

    'input[type=checkbox], input[type=radio]': {
      margin: '4px 0 0',
      lineHeight: 'normal'
    },

    /**
     * Remove global page padding by default
     */
    '.pf-c-page__main-section': {
      padding: 0,
      height: '100%',
      overflowY: 'hidden'
    },

    /**
     * Ensure dark background for login page.
     * - TODO: Revisit this after updating to use standard PF login components
     */
    '.pf-c-login, .login-pf': {
      backgroundImage: 'none',
      backgroundColor: PFColors.Black1000
    },

    /**
     * Datepicker overrides for graph replay and other uses
     * - note: global .tooltip setting but I think it should be OK
     */
    // use PF fonts and font-size
    '.react-datepicker': {
      fontFamily: 'var(--pf-global--FontFamily--sans-serif)',
      fontSize: 'var(--pf-global--FontSize)'
    },

    // provide more space for time container given bigger font
    '.react-datepicker__time-container': {
      width: '110px',
      $nest: {
        '.react-datepicker__time': {
          $nest: {
            '.react-datepicker__time-box': {
              width: '100%'
            }
          }
        }
      }
    },

    // Make sure datepicker popper rises above other inflated z-index elements
    //   - secondaryMasthead currently at 10
    '.react-datepicker-popper': {
      zIndex: 11
    },

    '.react-datepicker__navigation--next--with-time:not(.react-datepicker__navigation--next--with-today-button)': {
      right: '118px'
    },

    /**
     * Drawer panels should have less z-index than dropdowns
     */
    '.pf-c-drawer__panel': {
      zIndex: 199
    },

    /**
     * Health SVG visible
     */
    // eslint-disable-next-line no-multi-str
    'svg:not(:root).icon-failure, \
     svg:not(:root).icon-degraded, \
     svg:not(:root).icon-healthy, \
     svg:not(:root).icon-na': {
      overflow: 'visible'
    },

    /**
     * Padding for table rows
     */
    '.pf-c-table:not(.table) tr > *': {
      fontSize: 'var(--kiali-global--font-size)',
      paddingBottom: '8px',
      paddingTop: '8px'
    },

    '.pf-c-chart svg': {
      overflow: 'visible !important'
    }
  }
});
