import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import SwitchErrorBoundary from '../SwitchErrorBoundary/SwitchErrorBoundary';
import { pathRoutes, defaultRoute } from '../../routes';
import { Path } from '../../types/Routes';
import { style } from 'typestyle';
import { PFColors } from '../Pf/PfColors';
import { Button, ButtonVariant, EmptyState, EmptyStateBody, EmptyStateIcon, Title } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

const containerStyle = style({ marginLeft: 0, marginRight: 0 });
const containerPadding = style({ padding: '0 20px 0 20px' });
const containerGray = style({ background: PFColors.Black150 });
const containerError = style({ height: 'calc(100vh - 76px)' });

class RenderPage extends React.Component<{ isGraph: boolean }> {
  renderPaths(paths: Path[]) {
    return paths.map((item, index) => {
      return <Route key={index} path={item.path} component={item.component} render={item.render} />;
    });
  }

  render() {
    const component = (
      <div className={`${containerStyle} ${this.props.isGraph && containerPadding}`}>
        <SwitchErrorBoundary
          fallBackComponent={() => (
            <EmptyState className={containerError} variant="large">
              <EmptyStateIcon icon={KialiIcon.Error} />
              <Title headingLevel="h1" size="2xl">
                Something went wrong
              </Title>
              <EmptyStateBody>
                <p style={{ marginBottom: 'var(--pf-global--spacer--lg)' }}>
                  Sorry, there was a problem. Try a refresh or navigate to a different page.
                </p>
                <Button variant={ButtonVariant.primary} onClick={() => history.back()}>
                  Return to last page
                </Button>
              </EmptyStateBody>
            </EmptyState>
          )}
        >
          {this.renderPaths(pathRoutes)}
          <Redirect from="/" to={defaultRoute} />
        </SwitchErrorBoundary>
      </div>
    );
    return <>{!this.props.isGraph ? <div className={containerGray}>{component}</div> : component}</>;
  }
}

export default RenderPage;
