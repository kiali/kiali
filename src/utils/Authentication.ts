import store from '../store/ConfigStore';

export const authentication = () => {
  const actualState = store.getState() || {};
  if (actualState['authentication']['token'] !== undefined) {
    return 'Bearer ' + actualState['authentication']['token']['token'];
  }
  return '';
};
