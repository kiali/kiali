import deepFreeze from 'deep-freeze';

const jaegerQueryConfig = {
  path: '/search',
  embed: {
    uiEmbed: 'uiEmbed',
    version: 'v0'
  }
};

export const jaegerQuery = () => {
  return deepFreeze(jaegerQueryConfig) as typeof jaegerQueryConfig;
};
