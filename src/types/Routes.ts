import { PropTypes } from 'prop-types';

export interface Route {
  iconClass: string;
  title: string;
  to: string;
  redirect?: boolean;
  component: PropTypes.object;
  pathsActive?: RegExp[];
}

export interface Path {
  path: string;
  component: PropTypes.object;
}
