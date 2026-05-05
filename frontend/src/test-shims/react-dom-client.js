'use strict';

// React 17: RTL 14+ resolves `react-dom/client`, which does not exist before React 18.
// Map it to createRoot/hydrateRoot shims backed by react-dom 17 APIs so Jest can load RTL.
const ReactDOM = require('react-dom');

function createRoot(container) {
  return {
    render(element) {
      ReactDOM.render(element, container);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    }
  };
}

function hydrateRoot(container, initialChildren, options) {
  void options;
  const root = createRoot(container);
  if (initialChildren !== undefined) {
    ReactDOM.hydrate(initialChildren, container);
  }
  return root;
}

module.exports = {
  createRoot,
  hydrateRoot
};
