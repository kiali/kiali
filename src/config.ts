import deepFreeze from 'deep-freeze';

export const config = () => {
  return deepFreeze({
    version: '0.1',
    /** TimeOut in Hours */
    sessionTimeOutHoursAt: 3,
    /** Toolbar Configuration */
    toolbar: {
      /** Duration default in 1 minute */
      defaultDuration: 60,
      /** Options in interval duration */
      intervalDuration: {
        60: 'Last minute',
        300: 'Last 5 minutes',
        600: 'Last 10 minutes',
        1800: 'Last 30 minutes',
        3600: 'Last hour',
        10800: 'Last 3 hours',
        21600: 'Last 6 hours',
        43200: 'Last 12 hours',
        86400: 'Last day',
        604800: 'Last 7 days',
        2592000: 'Last 30 days'
      },
      /** By default refresh is 15 seconds */
      defaultPollInterval: 15000,
      /** Options in refresh */
      pollInterval: {
        0: 'Pause',
        5000: '5 seconds',
        10000: '10 seconds',
        15000: '15 seconds',
        30000: '30 seconds',
        60000: '1 minute',
        300000: '5 minutes'
      },
      /** Graphs layouts types */
      graphLayouts: {
        breadthfirst: 'Breadthfirst',
        cola: 'Cola',
        cose: 'Cose',
        dagre: 'Dagre',
        klay: 'Klay'
      }
    },
    /** Threshold limits */
    threshold: {
      percentErrorSevere: 2.0,
      percentErrorWarn: 0.1
    }
  });
};

/** Social networks in Login Page */
export const socialLinks = [
  {
    url: 'https://github.com/kiali',
    icon: { type: 'fa', name: 'github' },
    label: 'Github'
  },
  {
    url: 'https://www.youtube.com/channel/UCcm2NzDN_UCZKk2yYmOpc5w',
    icon: { type: 'fa', name: 'youtube' },
    label: 'Youtube'
  },
  {
    url: 'https://twitter.com/KialiProject',
    icon: { type: 'fa', name: 'twitter' },
    label: 'Twitter'
  }
];
