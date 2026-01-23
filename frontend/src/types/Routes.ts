import * as React from 'react';

export interface MenuItem {
  id: string;
  pathsActive?: RegExp[];
  separator?: boolean;
  title: string;
  to: string;
}

export interface Path {
  component?: any;
  path: string;
  render?: () => React.ReactNode;
}
