export const updateState = <S>(oldState: S, updatedState: Partial<S>): S => {
  return Object.assign({}, oldState, updatedState);
};
