// There are two ways in which we use the PF color palette. Either way we want to use the standard
// PF colors, and moreover, use the defined color variables such that any changes made by PF are
// picked up when the PF version is updated.  The preferred, standard way, is in CSS styling.  In
// those cases we can directly let CSS resolve the PF var. So, whenever possible use the PFColors
// enum below.

// Colors used by Kiali for CSS styling
export enum PFColors {
  Black100 = 'var(--pf-t--color--gray--10)',
  Black150 = 'var(--pf-t--color--gray--10)',
  Black200 = 'var(--pf-t--color--gray--20)',
  Black300 = 'var(--pf-t--color--gray--30)',
  Black400 = 'var(--pf-t--color--gray--40)',
  Black500 = 'var(--pf-t--color--gray--50)',
  Black600 = 'var(--pf-t--color--gray--60)',
  Black700 = 'var(--pf-t--color--gray--70)',
  Black800 = 'var(--pf-t--color--gray--80)',
  Black900 = 'var(--pf-t--color--gray--90)',
  Black1000 = 'var(--pf-t--color--gray--95)',
  Blue50 = 'var(--pf-t--color--blue--10)',
  Blue100 = 'var(--pf-t--color--blue--10)',
  Blue200 = 'var(--pf-t--color--blue--20)',
  Blue300 = 'var(--pf-t--color--blue--30)',
  Blue400 = 'var(--pf-t--color--blue--40)',
  Blue500 = 'var(--pf-t--color--blue--50)',
  Blue600 = 'var(--pf-t--color--teal--70)',
  Cyan300 = 'var(--pf-t--color--teal--40)',
  Gold300 = 'var(--pf-t--color--yellow--30)',
  Gold400 = 'var(--pf-t--color--yellow--40)',
  Gold500 = 'var(--pf-t--color--yellow--50)',
  Green300 = 'var(--pf-t--color--green--30)',
  Green400 = 'var(--pf-t--color--green--40)',
  Green500 = 'var(--pf-t--color--green--50)',
  Green600 = 'var(--pf-t--color--green--60)',
  LightBlue400 = 'var(--pf-t--chart--color--teal--200)',
  LightBlue500 = 'var(--pf-t--chart--color--teal--300)',
  LightGreen400 = 'var(--pf-t--color--green--40)',
  LightGreen500 = 'var(--pf-t--color--green--50)',
  Orange50 = 'var(--pf-t--color--orange--10)',
  Orange300 = 'var(--pf-t--color--orange--30)',
  Orange400 = 'var(--pf-t--color--orange--40)',
  Purple100 = 'var(--pf-t--color--purple--10)',
  Purple200 = 'var(--pf-t--color--purple--20)',
  Purple300 = 'var(--pf-t--color--purple--30)',
  Purple500 = 'var(--pf-t--color--purple--40)',
  Red50 = 'var(--pf-t--color--red--10)',
  Red100 = 'var(--pf-t--color--red--10)',
  Red200 = 'var(--pf-t--color--red--20)',
  Red500 = 'var(--pf-t--color--red--50)',
  White = 'var(--pf-t--color--white)',

  // semantic kiali colors
  Active = 'var(--pf-t--color--blue--50)',
  Badge = 'var(	pf-t--color--blue--30)',
  Replay = 'var(--pf-t--global--color--brand--100)',
  Link = 'var(--pf-t--global--text--color--link--default)',
  LinkTooltipDarkTheme = 'var(--pf-t--global--text--color--link--100)',
  LinkTooltipLightTheme = 'var(--pf-t--color--blue--20)', // code broken, should be --pf-t--global--dark--text--color--link--100

  // status colors https://www.patternfly.org/design-foundations/colors/#status-and-state-colors
  Danger = 'var(--pf-t--global--icon--color--status--danger--default)',
  Info = 'var(--pf-t--global--icon--color--status--info--default)',
  Success = 'var(--pf-t--global--icon--color--status--success--default)',
  Warning = 'var(--pf-t--global--icon--color--status--warning--default)',

  // chart-specific color values, for rates charts where 4xx is really Danger not Warning
  ChartDanger = 'var(--pf-t--chart--color--red-orange--500)',
  ChartOther = 'var(--pf-v6-global--palette-black-1000)',
  ChartWarning = 'var(--pf-t--chart--color--red-orange--400)',

  // PF background colors (compatible with dark mode)
  BackgroundColor100 = 'var(--pf-t--global--background--color--primary--default)',
  BackgroundColor150 = 'var(--pf-t--global--background--color--tertiary--default)',
  BackgroundColor200 = 'var(--pf-t--global--background--color--secondary--default)',
  BackgroundColorLight300 = 'var(--pf-t--global--background--color--secondary--default)',

  // PF standard colors (compatible with dark mode)
  Color100 = 'var(--pf-t--color--black)',
  Color200 = 'var(--pf-t--color--gray--50)',
  ColorLight100 = 'var(--pf-t--color--white)',
  ColorLight200 = 'var(--pf-t--color--gray--20)',
  ColorLight300 = 'var(--pf-t--color--gray--30)',

  // PF border colors (compatible with dark mode)
  BorderDefault = 'var(--pf-t--global--border--color--default)',
  BorderColor100 = 'var(--pf-t--global--border--color--100)',
  BorderColor200 = 'var(--pf-t--global--border--color--200)',
  BorderColor300 = 'var(--pf-t--global--border--color--300)',
  BorderColorLight100 = 'var(--pf-t--global--border--color--50)',

  // PF colors suitable for dark backgrounds (don't change in Dark mode)
  Color300 = 'var(--pf-t--global--dark--background--color--300)',
  Color400 = 'var(--pf-t--global--dark--background--color--400)'
}
