// There are two ways in which we use the PF color palette. Either way we want to use the standard
// PF colors, and moreover, use the defined color variables such that any changes made by PF are
// picked up when the PF version is updated.  The preferred, standard way, is in CSS styling.  In
// those cases we can directly let CSS resolve the PF var. So, whenever possible use the PFColors
// enum below.  In certain cases (like in cytoscape), we need the explicit hex value.  In that case
// we must actually get the computed value.  We do this as soon as we get an initial document (in
// StartupInitializer.tsx). In those cases use PFColorVals.  Note that those values are not
// available until they can be computed, so don't use them in constants or before they are
// available.

// Colors used by Kiali for CSS styling
export enum PFColors {
  Black100 = 'var(--pf-global--palette--black-100)',
  Black150 = 'var(--pf-global--palette--black-150)',
  Black200 = 'var(--pf-global--palette--black-200)',
  Black300 = 'var(--pf-global--palette--black-300)',
  Black400 = 'var(--pf-global--palette--black-400)',
  Black500 = 'var(--pf-global--palette--black-500)',
  Black600 = 'var(--pf-global--palette--black-600)',
  Black700 = 'var(--pf-global--palette--black-700)',
  Black800 = 'var(--pf-global--palette--black-800)',
  Black900 = 'var(--pf-global--palette--black-900)',
  Black1000 = 'var(--pf-global--palette--black-1000)',
  Blue200 = 'var(--pf-global--palette--blue-200)',
  Blue300 = 'var(--pf-global--palette--blue-300)',
  Blue400 = 'var(--pf-global--palette--blue-400)',
  Blue500 = 'var(--pf-global--palette--blue-500)',
  Blue600 = 'var(--pf-global--palette--blue-600)',
  Cyan300 = 'var(--pf-global--palette--cyan-300)',
  Gold400 = 'var(--pf-global--palette--gold-400)',
  Green300 = 'var(--pf-global--palette--green-300)',
  Green400 = 'var(--pf-global--palette--green-400)',
  Green500 = 'var(--pf-global--palette--green-500)',
  Green600 = 'var(--pf-global--palette--green-600)',
  LightBlue400 = 'var(--pf-global--palette--light-blue-400)',
  LightGreen400 = 'var(--pf-global--palette--light-green-400)',
  LightGreen500 = 'var(--pf-global--palette--light-green-500)',
  Orange300 = 'var(--pf-v5-global--palette--orange-300)',
  Orange400 = 'var(--pf-global--palette--orange-400)',
  Purple100 = 'var(--pf-global--palette--purple-100)',
  Purple200 = 'var(--pf-global--palette--purple-200)',
  Purple300 = 'var(--pf-v5-global--palette--purple-300)',
  Purple500 = 'var(--pf-global--palette--purple-500)',
  Red100 = 'var(--pf-global--palette--red-100)',
  Red200 = 'var(--pf-global--palette--red-200)',
  Red500 = 'var(--pf-global--palette--red-500)',
  White = 'var(--pf-global--palette--white)',

  // semantic kiali colors
  Active = 'var(--pf-global--active-color--400)',
  ActiveText = 'var(--pf-global--primary-color--200)',
  Badge = 'var(--pf-global--palette--blue-300)',
  Replay = 'var(--pf-global--active-color--300)',
  Link = 'var(--pf-global--link--Color)',

  // Health/Alert colors https://www.patternfly.org/v4/design-guidelines/styles/colors
  Danger = 'var(--pf-global--danger-color--100)',
  Info = 'var(--pf-global--info-color--100)',
  InfoBackground = 'var(--pf-global--info-color--200)',
  Success = 'var(--pf-global--success-color--100)',
  SuccessBackground = 'var(--pf-global--success-color--200)',
  Warning = 'var(--pf-global--warning-color--100)',

  // chart-specific color values, for rates charts where 4xx is really Danger not Warning
  ChartDanger = 'var(--pf-global--danger-color--300)',
  ChartOther = 'var(--pf-global--palette-black-1000)',
  ChartWarning = 'var(--pf-global--danger-color--100)',

  // PF background colors (compatible with dark mode)
  BackgroundColor100 = 'var(--pf-global--BackgroundColor--100)',
  BackgroundColor150 = 'var(--pf-global--BackgroundColor--150)',
  BackgroundColor200 = 'var(--pf-global--BackgroundColor--200)',

  // PF standard colors (compatible with dark mode)
  Color100 = 'var(--pf-global--Color--100)',
  Color200 = 'var(--pf-global--Color--200)',
  ColorLight100 = 'var(--pf-global--Color--light-100)',
  ColorLight200 = 'var(--pf-global--Color--light-200)',
  ColorLight300 = 'var(--pf-global--Color--light-300)',

  // PF border colors (compatible with dark mode)
  BorderColor100 = 'var(--pf-global--BorderColor--100)',
  BorderColor200 = 'var(--pf-global--BorderColor--200)',
  BorderColor300 = 'var(--pf-global--BorderColor--300)',
  BorderColorLight100 = 'var(--pf-global--BorderColor--light-100)',

  // PF colors suitable for dark backgrounds (don't change in Dark mode)
  Color300 = 'var(--pf-global--Color--300)',
  Color400 = 'var(--pf-global--Color--400)'
}

// The hex string value of the PF CSS variable
export type PFColorVal = string;

// Color values used by Kiali outside of CSS (i.e. when we must have the actual hex value)
export type PFColorValues = {
  Black100: PFColorVal;
  Black150: PFColorVal;
  Black200: PFColorVal;
  Black300: PFColorVal;
  Black400: PFColorVal;
  Black500: PFColorVal;
  Black600: PFColorVal;
  Black700: PFColorVal;
  Black1000: PFColorVal;
  Blue50: PFColorVal;
  Blue300: PFColorVal;
  Blue600: PFColorVal;
  Red50: PFColorVal;
  Orange50: PFColorVal;
  Gold400: PFColorVal;
  Green400: PFColorVal;
  Purple200: PFColorVal;
  White: PFColorVal;

  // Health/Alert colors https://www.patternfly.org/v4/design-guidelines/styles/colors
  Danger: PFColorVal;
  Success: PFColorVal;
  Warning: PFColorVal;

  // PF colors (compatible with dark mode)
  BackgroundColor100: PFColorVal;
  BackgroundColor200: PFColorVal;
  BackgroundColor300: PFColorVal;

  Color100: PFColorVal;
  Color200: PFColorVal;

  BorderColor100: PFColorVal;
  BorderColor200: PFColorVal;
  BorderColor300: PFColorVal;

  // PF colors for dark backgrounds (don't change in dark mode)
  Color300: PFColorVal;
  Color400: PFColorVal;
};

export let PFColorVals: PFColorValues;

export const setPFColorVals = (element: Element) => {
  PFColorVals = {
    // color values used by kiali
    Black100: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-100'),
    Black150: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-150'),
    Black200: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-200'),
    Black300: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-300'),
    Black400: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-400'),
    Black500: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-500'),
    Black600: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-600'),
    Black700: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-700'),
    Black1000: getComputedStyle(element).getPropertyValue('--pf-global--palette--black-1000'),
    Blue50: getComputedStyle(element).getPropertyValue('--pf-global--palette--blue-50'),
    Blue300: getComputedStyle(element).getPropertyValue('--pf-global--palette--blue-300'),
    Blue600: getComputedStyle(element).getPropertyValue('--pf-global--palette--blue-600'),
    Red50: getComputedStyle(element).getPropertyValue('--pf-global--palette--red-50'),
    Orange50: getComputedStyle(element).getPropertyValue('--pf-global--palette--orange-50'),
    Gold400: getComputedStyle(element).getPropertyValue('--pf-global--palette--gold-400'),
    Green400: getComputedStyle(element).getPropertyValue('--pf-global--palette--green-400'),
    Purple200: getComputedStyle(element).getPropertyValue('--pf-global--palette--purple-200'),
    White: getComputedStyle(element).getPropertyValue('--pf-global--palette--white'),

    // status color values used by kiali
    Danger: getComputedStyle(element).getPropertyValue('--pf-global--danger-color--100'),
    Success: getComputedStyle(element).getPropertyValue('--pf-global--success-color--100'),
    Warning: getComputedStyle(element).getPropertyValue('--pf-global--warning-color--100'),

    // PF colors (compatible with dark mode)
    BackgroundColor100: getComputedStyle(element).getPropertyValue('--pf-global--BackgroundColor--100'),
    BackgroundColor200: getComputedStyle(element).getPropertyValue('--pf-global--BackgroundColor--200'),
    BackgroundColor300: getComputedStyle(element).getPropertyValue('--pf-global--BackgroundColor--300'),

    Color100: getComputedStyle(element).getPropertyValue('--pf-global--Color--100'),
    Color200: getComputedStyle(element).getPropertyValue('--pf-global--Color--200'),

    BorderColor100: getComputedStyle(element).getPropertyValue('--pf-global--BorderColor--100'),
    BorderColor200: getComputedStyle(element).getPropertyValue('--pf-global--BorderColor--200'),
    BorderColor300: getComputedStyle(element).getPropertyValue('--pf-global--BorderColor--300'),

    // PF colors for dark backgrounds (don't change in dark mode)
    Color300: getComputedStyle(element).getPropertyValue('--pf-global--BorderColor--300'),
    Color400: getComputedStyle(element).getPropertyValue('--pf-global--BorderColor--400')
  };
};
