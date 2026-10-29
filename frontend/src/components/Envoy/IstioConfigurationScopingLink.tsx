import * as React from 'react';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { istioConfigurationScopingUrl } from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';

type IstioConfigurationScopingLinkProps = {
  dataTest?: string;
  externalLinkIconClassName?: string;
};

export const IstioConfigurationScopingLink: React.FC<IstioConfigurationScopingLinkProps> = ({
  dataTest,
  externalLinkIconClassName
}) => (
  <Button
    component="a"
    data-test={dataTest}
    href={istioConfigurationScopingUrl()}
    icon={externalLinkIconClassName ? <KialiIcon.ExternalLink className={externalLinkIconClassName} /> : undefined}
    isInline
    rel="noopener noreferrer"
    target="_blank"
    variant={ButtonVariant.link}
  >
    {t('Learn about configuration scoping')}
  </Button>
);
