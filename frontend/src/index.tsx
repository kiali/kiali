import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { globalStyle } from 'styles/GlobalStyle';
import { RouterProvider } from 'react-router-dom-v5-compat';
import { rootBasename, router, setRouter } from 'app/History';
import { pathRoutes } from 'routes';
import { App } from 'app/App';
import cssVariables from './styles/variables.module.scss';
import '@patternfly/patternfly/patternfly.css';
import '@patternfly/patternfly/patternfly-charts.css';
import '@patternfly/patternfly/patternfly-addons.css';

// Enables ACE editor YAML themes
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-eclipse';
import 'ace-builds/src-noconflict/theme-twilight';

// Enables the search box for the ACE editor
import 'ace-builds/src-noconflict/ext-searchbox';

// i18n
import './i18n';

// Ignore ResizeObserver error - it's a known issue in some browsers and PatternFly components
// that doesn't actually impact functionality but can trigger error overlays in development.
window.addEventListener('error', e => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
    const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
    if (resizeObserverErr) {
      resizeObserverErr.setAttribute('style', 'display: none');
    }
    if (resizeObserverErrDiv) {
      resizeObserverErrDiv.setAttribute('style', 'display: none');
    }
  }
});

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

/**
 * Render the application.
 */
const renderApp = (): void => {
  setRouter([
    {
      element: <App />,
      children: pathRoutes
    }
  ]);

  // redirect to the router basename if the pathname does not include it
  if (!window.location.pathname.includes(rootBasename)) {
    router.navigate(`/${window.location.search}`, { replace: true });
  }

  ReactDOM.render(<RouterProvider router={router} />, document.getElementById('root') as HTMLElement);
};

if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_MOCK_API === 'true') {
  // Enable API mocking with MSW (Mock Service Worker).
  // This allows frontend development without a running backend.
  // @ts-ignore - mocks folder is excluded from TypeScript compilation for production builds
  import('./mocks/browser').then(({ worker }) => {
    worker
      .start({
        onUnhandledRequest: 'warn',
        quiet: false
      })
      .then(() => {
        renderApp();
      });
  });
} else {
  // No mocking - render immediately
  renderApp();
}
