export enum PfColors {
  Black100 = '#fafafa',
  Black150 = '#f5f5f5',
  Black200 = '#ededed',
  Black300 = '#d1d1d1',
  Black400 = '#bbb',
  Black500 = '#8b8d8f',
  Black600 = '#72767b',
  Black700 = '#4d5258',
  Black800 = '#393f44',
  Black900 = '#292e34',
  Black1000 = '#030303',
  Blue50 = '#def3ff',
  Blue100 = '#bee1f4',
  Blue200 = '#7dc3e8',
  Blue300 = '#39a5dc',
  Blue400 = '#0088ce',
  Blue500 = '#00659c',
  Blue600 = '#004368',
  Blue700 = '#002235',
  Cyan100 = '#bedee1',
  Cyan200 = '#7dbdc3',
  Cyan300 = '#3a9ca6',
  Cyan400 = '#007a87',
  Cyan500 = '#005c66',
  Cyan600 = '#003d44',
  Cyan700 = '#001f22',
  Gold100 = '#fbeabc',
  Gold200 = '#f9d67a',
  Gold300 = '#f5c12e',
  Gold400 = '#f0ab00',
  Gold500 = '#b58100',
  Gold600 = '#795600',
  Gold700 = '#3d2c00',
  Green100 = '#cfe7cd',
  Green200 = '#9ecf99',
  Green300 = '#6ec664',
  Green400 = '#3f9c35',
  Green500 = '#3e8635',
  Green600 = '#1e4f18',
  Green700 = '#0f280d',
  LightBlue100 = '#beedf9',
  LightBlue200 = '#7cdbf3',
  LightBlue300 = '#35caed',
  LightBlue400 = '#00b9e4',
  LightBlue500 = '#008bad',
  LightBlue600 = '#005c73',
  LightBlue700 = '#002d39',
  LightGreen100 = '#e4f5bc',
  LightGreen200 = '#c8eb79',
  LightGreen300 = '#ace12e',
  LightGreen400 = '#92d400',
  LightGreen500 = '#6ca100',
  LightGreen600 = '#486b00',
  LightGreen700 = '#253600',
  Orange100 = '#fbdebf',
  Orange200 = '#f7bd7f',
  Orange300 = '#f39d3c',
  Orange400 = '#ec7a08',
  Orange500 = '#b35c00',
  Orange600 = '#773d00',
  Orange700 = '#3b1f00',
  Purple100 = '#c7bfff',
  Purple200 = '#a18fff',
  Purple300 = '#8461f7',
  Purple400 = '#703fec',
  Purple500 = '#582fc0',
  Purple600 = '#40199a',
  Purple700 = '#1f0066',
  Red100 = '#cc0000',
  Red200 = '#a30000',
  Red300 = '#8b0000',
  Red400 = '#470000',
  Red500 = '#2c0000',

  White = '#fff',
  Black = '#030303',

  Blue = '#0088ce', // Blue400
  Cyan = '#007a87', // Cyan400
  Gold = '#f0ab00', // Gold400
  Green = '#3f9c35', // Green400
  LightBlue = '#00b9e4', // LightBlue400
  LightGreen = '#92d400', // LightGreen400
  Orange = '#ec7a08', // Orange400
  Red = '#cc0000', // Red100

  //
  // Kiali colors that use PF colors
  //
  Gray = Black600,
  GrayBackground = Black150
}

// The hex string value of the PF CSS variable
export type PFColorVal = string;

// Health/Alert colors https://www.patternfly.org/v4/design-guidelines/styles/colors
export type PFAlertColorVals = {
  Danger: PFColorVal;
  DangerBackground: PFColorVal;
  Info: PFColorVal;
  InfoBackground: PFColorVal;
  Success: PFColorVal;
  SuccessBackground: PFColorVal;
  Warning: PFColorVal;
  WarningBackground: PFColorVal;
};

let PFAlertColorValsInstance: PFAlertColorVals | undefined;

export const getPFAlertColorVals = (): PFAlertColorVals => {
  if (!PFAlertColorValsInstance) {
    const root = document.documentElement;
    PFAlertColorValsInstance = {
      Danger: getComputedStyle(root).getPropertyValue('--pf-global--danger-color--100'),
      DangerBackground: getComputedStyle(root).getPropertyValue('--pf-global--danger-color--200'),
      Info: getComputedStyle(root).getPropertyValue('--pf-global--info-color--100'),
      InfoBackground: getComputedStyle(root).getPropertyValue('--pf-global--info-color--200'),
      // TODO: go back to var when PF vars is properly updated
      // Success: getComputedStyle(root).getPropertyValue('--pf-global--success-color--100'),
      Success: '#3e8635',
      SuccessBackground: getComputedStyle(root).getPropertyValue('--pf-global--success-color--200'),
      Warning: getComputedStyle(root).getPropertyValue('--pf-global--warning-color--100'),
      WarningBackground: getComputedStyle(root).getPropertyValue('--pf-global--warning-color--200')
    };
  }
  return PFAlertColorValsInstance;
};

export enum PFAlertColor {
  Danger = 'var(--pf-global--danger-color--100)',
  DangerBackground = 'var(--pf-global--danger-color--200)',
  Info = 'var(--pf-global--info-color--100)',
  InfoBackground = 'var(--pf-global--info-color--200)',
  // TODO: go back to var when PF vars is properly updated
  // Success = 'var(--pf-global--success-color--100)',
  Success = '#3e8635',
  SuccessBackground = 'var(--pf-global--success-color--200)',
  Warning = 'var(--pf-global--warning-color--100)',
  WarningBackground = 'var(--pf-global--warning-color--200)'
}

export enum PFKialiColor {
  Active = 'var(--pf-global--active-color--400)',
  ActiveText = 'var(--pf-global--primary-color--200)',
  Replay = 'var(--pf-global--active-color--300)'
}

export const withAlpha = (color: PfColors, hexAlpha: string) => {
  return color + hexAlpha;
};
