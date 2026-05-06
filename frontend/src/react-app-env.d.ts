/// <reference types="@rsbuild/core/types" />
/// <reference types="@rstest/core/globals" />
/// <reference types="@testing-library/jest-dom" />

/* eslint-disable import/no-default-export */
declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
  const src: string;
  export default src;
}
