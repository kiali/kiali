import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../Pf/PfColors';
import {
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateHeader
} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { Outlet } from 'react-router-dom-v5-compat';
import { t } from 'utils/I18nUtils';
import { pathRoutes } from 'routes';
import { router } from 'app/History';
import { MASTHEAD_HEIGHT } from './Navigation';

const containerStyle = kialiStyle({ marginLeft: 0, marginRight: 0 });
const containerPadding = kialiStyle({ padding: '0 20px 0 20px' });
const containerGray = kialiStyle({ background: PFColors.BackgroundColor200, height: '100%' });
const containerError = kialiStyle({ height: `calc(100vh - ${MASTHEAD_HEIGHT})` });

// Add error boundary element to every path route
pathRoutes.forEach(route => {
  route.errorElement = (
    <EmptyState className={containerError} variant="lg">
      <EmptyStateHeader
        titleText={t('Something went wrong')}
        icon={<EmptyStateIcon icon={KialiIcon.Error} />}
        headingLevel="h1"
      />
      <EmptyStateBody>
        <p style={{ marginBottom: 'var(--pf-v5-global--spacer--lg)' }}>
          {t('Sorry, there was a problem. Try a refresh or navigate to a different page.')}
        </p>
        <Button
          variant={ButtonVariant.primary}
          onClick={() => {
            router.navigate(-1);
          }}
        >
          {t('Return to last page')}
        </Button>
      </EmptyStateBody>
    </EmptyState>
  );
});

export const RenderPage: React.FC<{ isGraph: boolean }> = ({ isGraph }) => {
  return (
    <div className={`${containerStyle} ${isGraph ? containerPadding : containerGray}`}>
      <Outlet />
    </div>
  );
};
