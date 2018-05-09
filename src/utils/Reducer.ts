export const updateState = (oldState, updatedState) => {
  return {
    ...oldState,
    ...updatedState
  };
};
