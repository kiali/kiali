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
// The new URL(..., import.meta.url) pattern is required so Rspack emits each worker
// with correct chunk-loading paths. A plain `import * as monaco` plus `loader.config`
// breaks because assetPrefix is relative ('./') and workers resolve it from their own
// URL, producing doubled paths like /static/js/async/static/js/...
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'json':
        return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url));
      case 'css':
      case 'scss':
      case 'less':
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url));
      case 'html':
      case 'handlebars':
      case 'razor':
        return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url));
      case 'typescript':
      case 'javascript':
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url));
      default:
        return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url));
    }
  }
};

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
