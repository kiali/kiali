import * as React from 'react';

export const useBoolean = (
  initialValue: boolean,
): [boolean, () => void, () => void, () => void, (v: boolean) => void] => {
  const [value, setValue] = React.useState(initialValue);
  const toggle = React.useCallback(() => setValue((v) => !v), []);
  const setTrue = React.useCallback(() => setValue(true), []);
  const setFalse = React.useCallback(() => setValue(false), []);
  const set = React.useCallback((v: boolean) => setValue(v), []);
  return [value, toggle, setTrue, setFalse, set];
};
