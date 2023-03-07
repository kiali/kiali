export const updateState = <S>(oldState: S, updatedState: Partial<S>): S => {
  return { ...oldState, ...updatedState };
};
