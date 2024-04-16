import * as React from 'react';
import {
  AboutModal,
  TextContent,
  TextList,
  TextListItem,
  Title,
  Button,
  TitleSizes,
  ButtonVariant,
  Alert
} from '@patternfly/react-core';
import kialiIconAbout from '../../assets/img/icon-aboutbkg.svg';
import { Status, StatusKey } from '../../types/StatusState';
import { config, kialiLogoDark } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { ReactComponent as IstioLogo } from '../../assets/img/mesh/istio.svg';
import { Link } from 'react-router-dom';

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
  marginBottom: '-2px',
  marginRight: '0.5rem',
  marginTop: '1rem'
});

const textContentStyle = kialiStyle({
  $nest: {
    '& dt, & dd': {
      lineHeight: 1.667
    }
  }
});

const websiteStyle = kialiStyle({
  marginRight: '2rem'
});

export const AboutUIModal: React.FC<AboutUIModalProps> = (props: AboutUIModalProps) => {
  const renderMeshLink = () => {
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

  const renderProjectLink = () => {
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

  const renderWebsiteLink = (): JSX.Element | null => {
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

  const meshVersion = props.status[StatusKey.MESH_NAME]
    ? `${props.status[StatusKey.MESH_NAME]} ${props.status[StatusKey.MESH_VERSION] ?? ''}`
    : 'Unknown';

  return (
    <AboutModal
      backgroundImageSrc={kialiIconAbout}
      brandImageSrc={kialiLogoDark}
      brandImageAlt="Kiali Logo"
      className={modalStyle}
      isOpen={props.isOpen}
      onClose={props.onClose}
      productName="Kiali"
    >
      <TextContent className={textContentStyle}>
        <TextList component="dl">
          <TextListItem key="kiali-name" component="dt">
            Kiali
          </TextListItem>
          <TextListItem key="kiali-version" component="dd">
            {coreVersion!}
          </TextListItem>
          <TextListItem key="kiali-container-name" component="dt">
            Kiali Container
          </TextListItem>
          <TextListItem key="kiali-container-version" component="dd">
            {containerVersion!}
          </TextListItem>
          {false && (
            <>
              <TextListItem key="service-mesh-name" component="dt">
                Service Mesh
              </TextListItem>
              <TextListItem key="service-mesh-version" component="dd">
                {meshVersion!}
              </TextListItem>
            </>
          )}
        </TextList>
      </TextContent>

      {props.warningMessages.length > 0 && (
        <Alert variant="warning" title={props.warningMessages[0]} style={{ marginTop: '1rem' }} />
      )}

      <TextContent className={textContentStyle}>
        <Title headingLevel="h3" size={TitleSizes.xl} style={{ padding: '2.5rem 0 0 0', marginBottom: '0' }}>
          Components
        </Title>
        {renderMeshLink()}

        <Title headingLevel="h3" size={TitleSizes.xl} style={{ padding: '1.0rem 0 0 0', marginBottom: '0' }}>
          External Links
        </Title>
        {renderWebsiteLink()}
        {renderProjectLink()}
      </TextContent>
    </AboutModal>
  );
};
