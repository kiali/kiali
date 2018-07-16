import { PropTypes } from 'prop-types';

export interface MenuItem {
  iconClass: string;
  title: string;
  to: string;
  pathsActive?: RegExp[];
}

export interface Path {
  path: string;
  component: PropTypes.object;
}
