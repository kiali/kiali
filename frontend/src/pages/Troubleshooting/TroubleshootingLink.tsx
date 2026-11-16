import * as React from 'react';
import { Link } from 'react-router-dom-v5-compat';
import { KialiLink } from 'components/Link/KialiLink';
import { isOSSMC } from 'utils/NavigationUtils';

type TroubleshootingLinkProps = {
  children: React.ReactNode;
  dataTest?: string;
  to: string;
};

/**
 * Resource links on the troubleshooting page.
 * OSSMC already has Console paths, so skip kiosk postMessage and use the Console router.
 */
export const TroubleshootingLink: React.FC<TroubleshootingLinkProps> = ({ children, dataTest, to }) => {
  if (isOSSMC()) {
    return (
      <Link data-test={dataTest} to={to}>
        {children}
      </Link>
    );
  }

  return (
    <KialiLink dataTest={dataTest} to={to}>
      {children}
    </KialiLink>
  );
};
