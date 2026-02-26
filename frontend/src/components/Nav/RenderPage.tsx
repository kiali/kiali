import * as React from 'react';
import { Button, ButtonVariant, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { Outlet } from 'react-router-dom-v5-compat';
import { t } from 'utils/I18nUtils';
import { pathRoutes } from 'routes';
import { router } from 'app/History';
import { kialiStyle } from 'styles/StyleUtils';

// Add error boundary element to every path route
pathRoutes.forEach(route => {
  route.errorElement = (
    <EmptyState headingLevel="h1" icon={KialiIcon.Error} titleText={t('Something went wrong')} variant="lg">
      <EmptyStateBody>
        <p style={{ marginBottom: 'var(--pf-t--global--spacer--lg)' }}>
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

const renderPageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0
});

export const RenderPage: React.FC<{ isGraph: boolean }> = () => {
  return (
    <div className={renderPageStyle}>
      <Outlet />
    </div>
  );
};
