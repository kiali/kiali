import * as React from 'react';

export interface MenuItem {
  id: string;
  title: string;
  to: string;
  pathsActive?: RegExp[];
}

export interface Path {
  path: string;
  component?: any;
  render?: () => React.ReactNode;
}
