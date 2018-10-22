export interface MenuItem {
  iconClass: string;
  title: string;
  to: string;
  pathsActive?: RegExp[];
}

export interface Path {
  path: string;
  component: any;
}
