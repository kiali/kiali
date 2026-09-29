import * as React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';
import { NamespaceDropdown } from '../Dropdown/NamespaceDropdown';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { getPagePath } from '../../utils/NavigationUtils';
import { useKialiTranslation } from 'utils/I18nUtils';

const titles = ['applications', 'istio', 'istio/new', 'mesh', 'namespaces', 'overview', 'services', 'workloads'];

const resolvePageTitleKey = (path: string): string => {
  if (path.startsWith('istio/new/')) {
    const objectType = kindToStringIncludeK8s(path.substring(10), path.substring(path.lastIndexOf('/') + 1));
    return `Create ${objectType}`;
  }

  if (path.startsWith('istio')) {
    return 'Istio Config';
  }

  if (path.startsWith('mesh')) {
    return 'Clusters';
  }

  if (path.startsWith('applications')) {
    return 'Applications';
  }

  if (path.startsWith('workloads')) {
    return 'Workloads';
  }

  if (path.startsWith('services')) {
    return 'Services';
  }

  if (path.startsWith('namespaces')) {
    return 'Namespaces';
  }

  if (path.startsWith('overview')) {
    return 'Overview';
  }

  const basePath = path.split('/')[0];
  return `${basePath.charAt(0).toUpperCase()}${basePath.slice(1)}`;
};

const titleSuffixStyle = kialiStyle({
  fontSize: '0.875rem',
  fontWeight: 400,
  marginLeft: '0.75rem',
  color: PFColors.Color200
});

const containerStyle = kialiStyle({
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  marginBottom: '1.25rem'
});

const flexStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const titleStyle = kialiStyle({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap'
});

const rightToolbarStyle = kialiStyle({
  position: 'absolute',
  right: '3rem',
  zIndex: 1
});

const actionsToolbarStyle = kialiStyle({
  marginLeft: 'auto',
  paddingTop: '0.75rem'
});

type Props = {
  actionsToolbar?: JSX.Element;
  hideNamespaceSelector?: boolean;
  rightToolbar?: JSX.Element;
  titleSuffix?: React.ReactNode;
};

export const DefaultSecondaryMasthead: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const showTitle = (): { disabled: boolean; title: React.ReactNode } => {
    const path = getPagePath();

    if (titles.some(titlePath => path.startsWith(titlePath))) {
      const title = t(resolvePageTitleKey(path));
      const disabled = false;

      return {
        title: (
          <>
            <Title headingLevel="h1" size={TitleSizes['2xl']} style={{ margin: '1rem 0 0.5rem' }}>
              {title}
            </Title>
          </>
        ),
        disabled: disabled
      };
    }

    return { title: undefined, disabled: false };
  };

  const { title, disabled } = showTitle();

  return (
    <div className={containerStyle}>
      <div className={flexStyle}>
        <div>{props.hideNamespaceSelector === true ? null : <NamespaceDropdown disabled={disabled} />}</div>

        {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
      </div>

      <div className={flexStyle}>
        <div className={titleStyle}>
          {title}
          {props.titleSuffix && <span className={titleSuffixStyle}>{props.titleSuffix}</span>}
        </div>

        {props.actionsToolbar && <div className={actionsToolbarStyle}>{props.actionsToolbar}</div>}
      </div>
    </div>
  );
};
