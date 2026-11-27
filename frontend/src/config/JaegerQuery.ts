import { deepFreeze } from '../utils/deepFreeze';

const jaegerQueryConfig = deepFreeze({
  path: '/search',
  embed: {
    uiEmbed: 'uiEmbed',
    version: 'v0'
  }
});

export const jaegerQuery = (): typeof jaegerQueryConfig => {
  return jaegerQueryConfig;
};
