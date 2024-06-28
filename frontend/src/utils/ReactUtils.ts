import React from 'react';

export const usePreviousValue = (value: unknown): unknown => {
  const ref = React.useRef<unknown>();

  React.useEffect(() => {
    ref.current = value;
  });

  return ref.current;
};
