import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import { routes, pathRoutes } from '../../routes';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';

class RenderPage extends React.Component {
  renderRoutes() {
    let redirectRoot: any = undefined;

    return {
      renderRoutes: routes.map((item, index) => {
        if (item.redirect === true) {
          redirectRoot = <Redirect from="/" to={item.to} />;
        }

        return <Route key={index} path={item.to} component={item.component} />;
      }),
      redirectRoot,
      renderPaths: pathRoutes.map((item, index) => {
        return <Route key={index} path={item.path} component={item.component} />;
      })
    };
  }

  render() {
    const { renderRoutes, redirectRoot, renderPaths } = this.renderRoutes();

    return (
      <PfContainerNavVertical>
        <SwitchErrorBoundary
          fallBackComponent={() => <h2>Sorry, there was a problem. Try a refresh or navigate to a different page.</h2>}
        >
          {renderRoutes}
          {renderPaths}
          {redirectRoot}
        </SwitchErrorBoundary>
      </PfContainerNavVertical>
    );
  }
}

export default RenderPage;
