import * as React from 'react';
import { AboutModal, Content, Title, Button, TitleSizes, ButtonVariant, Alert } from '@patternfly/react-core';
import kialiIconAbout from '../../assets/img/kiali/icon-aboutbkg.svg';
import { Status, StatusKey } from '../../types/StatusState';
import { config, kialiIconDark, kialiIconLight } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { ReactComponent as IstioLogo } from '../../assets/img/mesh/istio.svg';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { isControlPlaneAccessible } from '../../utils/MeshUtils';
import { useKialiTheme } from 'utils/ThemeUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { Theme } from 'types/Common';

type AboutUIModalProps = {
  isOpen: boolean;
  onClose: () => void;
  status: Status;
  warningMessages: string[];
};

const modalStyle = kialiStyle({
  height: '100%',
  gridTemplateColumns: 'auto'
});

const iconStyle = kialiStyle({
  height: '1rem',
  marginBottom: '-0.25rem',
  marginRight: '0.5rem',
  marginTop: '1rem',
  $nest: {
    '& path': {
      fill: PFColors.Link
    }
  }
});

const websiteStyle = kialiStyle({
  marginRight: '2rem'
});

const alertStyle = kialiStyle({
  marginTop: '1rem',
  $nest: {
    '& .pf-v6-c-alert__title': {
      marginTop: 0
    }
  }
});

const componentsTitleStyle = kialiStyle({
  marginBottom: 0,
  paddingTop: '2.5rem'
});

const externalLinksTitleStyle = kialiStyle({
  marginBottom: 0,
  paddingTop: '1rem'
});

export const AboutUIModal: React.FC<AboutUIModalProps> = (props: AboutUIModalProps) => {
  const { t } = useKialiTranslation();
  const darkTheme = useKialiTheme() === Theme.DARK;

  const renderMeshLink = (): React.ReactNode => {
    if (config?.about?.mesh) {
      return (
        <Link id="mesh" to={config.about.mesh.url} onClick={props.onClose}>
          <IstioLogo className={iconStyle} />
          {config.about.mesh.linkText}
        </Link>
      );
    }

    return null;
  };

  const renderProjectLink = (): React.ReactNode => {
    if (config?.about?.project) {
      return (
        <Button component="a" href={config.about.project.url} variant={ButtonVariant.link} target="_blank" isInline>
          <KialiIcon.Github className={iconStyle} />
          {config.about.project.linkText}
        </Button>
      );
    }

    return null;
  };

  const renderWebsiteLink = (): React.ReactNode => {
    if (config?.about?.website) {
      return (
        <Button
          className={websiteStyle}
          component="a"
          href={config.about.website.url}
          variant={ButtonVariant.link}
          target="_blank"
          isInline
        >
          <KialiIcon.Website className={iconStyle} />
          {config.about.website.linkText}
        </Button>
      );
    }

    return null;
  };

  const coreVersion =
    props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === '' ||
    props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === 'unknown'
      ? props.status[StatusKey.KIALI_CORE_VERSION]
      : `${props.status[StatusKey.KIALI_CORE_VERSION]} (${props.status[StatusKey.KIALI_CORE_COMMIT_HASH]})`;

  const containerVersion = props.status[StatusKey.KIALI_CONTAINER_VERSION];

  return (
    <AboutModal
      backgroundImageSrc={kialiIconAbout}
      brandImageSrc={darkTheme ? kialiIconDark : kialiIconLight}
      brandImageAlt={t('Kiali Logo')}
      className={modalStyle}
      isOpen={props.isOpen}
      onClose={props.onClose}
      productName="Kiali"
    >
      <Content component="dl">
        <Content key="kiali-name" component="dt">
          Kiali
        </Content>
        <Content key="kiali-version" component="dd" data-test="kiali-version">
          {coreVersion!}
        </Content>
        <Content key="kiali-container-name" component="dt">
          {t('Kiali Container')}
        </Content>
        <Content key="kiali-container-version" component="dd" data-test="kiali-container-version">
          {containerVersion!}
        </Content>
      </Content>

      {props.warningMessages.length > 0 && (
        <Alert variant="warning" isInline={true} title={props.warningMessages[0]} className={alertStyle} />
      )}

      <Content>
        {isControlPlaneAccessible() && (
          <>
            <Title headingLevel="h3" size={TitleSizes.xl} className={componentsTitleStyle}>
              {t('Components')}
            </Title>
            {renderMeshLink()}
          </>
        )}
        <Title headingLevel="h3" size={TitleSizes.xl} className={externalLinksTitleStyle}>
          {t('External Links')}
        </Title>
        {renderWebsiteLink()}
        {renderProjectLink()}
      </Content>
    </AboutModal>
  );
};
