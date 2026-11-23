import { deepFreeze } from '../utils/deepFreeze';

const jaegerQueryConfig = {
  path: '/search',
  embed: {
    uiEmbed: 'uiEmbed',
    version: 'v0'
  }
};

export const jaegerQuery = (): typeof jaegerQueryConfig => {
  return deepFreeze(jaegerQueryConfig) as typeof jaegerQueryConfig;
};
