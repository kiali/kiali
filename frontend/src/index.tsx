import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { globalStyle } from 'styles/GlobalStyle';
import { RouterProvider } from 'react-router-dom-v5-compat';
import { router, setRouter } from 'app/History';
import { pathRoutes } from 'routes';
import { App } from 'app/App';
import cssVariables from './styles/variables.module.scss';
import '@patternfly/patternfly/patternfly.css';
import '@patternfly/patternfly/patternfly-charts.css';
import '@patternfly/patternfly/patternfly-charts-theme-dark.css';
import '@patternfly/patternfly/patternfly-addons.css';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/themes/light-border.css';

// Enables ACE editor YAML themes
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-eclipse';
import 'ace-builds/src-noconflict/theme-twilight';

// Enables the search box for the ACE editor
import 'ace-builds/src-noconflict/ext-searchbox';

// i18n
import './i18n';

declare global {
  interface Date {
    toLocaleStringWithConditionalDate(): string;
  }
}

// eslint-disable-next-line no-extend-native
Date.prototype.toLocaleStringWithConditionalDate = function () {
  const nowDate = new Date().toLocaleDateString();
  const thisDate = this.toLocaleDateString();

  return nowDate === thisDate ? this.toLocaleTimeString() : this.toLocaleString();
};

// Adding global styles and CSS variables to body element
document.body.classList.add(cssVariables.style);
document.body.classList.add(globalStyle);

setRouter([
  {
    element: <App />,
    children: pathRoutes
  }
]);

// redirect to the router basename /console from the root pathname /
if (window.location.pathname === '/') {
  router.navigate('/');
}

ReactDOM.render(<RouterProvider router={router} />, document.getElementById('root') as HTMLElement);
