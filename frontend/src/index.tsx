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

// i18n
import './i18n';

// Use the locally bundled monaco-editor instead of fetching from cdn.jsdelivr.net.
// Without this, @monaco-editor/react loads worker scripts from the CDN at runtime,
// which fails in air-gapped environments and causes flaky CI failures.
//
// We import the editor API entry point (without worker bundles) to avoid web worker
// chunk-loading. Workers use importScripts with the relative assetPrefix ('./'), which
// resolves incorrectly from their nested async directory, producing doubled paths like
// /static/js/async/static/js/... Running language services on the main thread is fine
// for Kiali's small YAML/JSON config editing.
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

loader.config({ monaco });

declare global {
  interface Date {
    toLocaleStringWithConditionalDate(): string;
  }
}

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
