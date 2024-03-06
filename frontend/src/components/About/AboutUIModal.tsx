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
import { IstioLogo } from 'pages/Mesh/MeshLegendData';

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
  marginTop: '1rem',
  marginRight: '0.5rem'
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
  /*
  const additionalComponentInfoContent = (externalService: ExternalServiceInfo) => {
    if (!externalService.version && !externalService.url) {
      return 'N/A';
    }

    const version = externalService.version ?? '';
    const url = externalService.url ? (
      <a href={externalService.url} target="_blank" rel="noopener noreferrer">
        {externalService.url}
      </a>
    ) : (
      ''
    );

    return (
      <>
        {version} {url}
      </>
    );
  };
  */

  /*
  const renderTempo = (externalServices: ExternalServiceInfo[]) => {
    const tempoService = externalServices.find(service => service.name === TEMPO);

    if (tempoService) {
      tempoService.url = GetTracingUrlProvider(externalServices)?.HomeUrl();
      return renderComponent(tempoService);
    } else {
      return <></>;
    }
  };
  */

  /*
  const renderComponent = (externalService: ExternalServiceInfo) => {
    const name = externalService.version ? externalService.name : `${externalService.name} URL`;
    const additionalInfo = additionalComponentInfoContent(externalService);
    return (
      <React.Fragment key={name}>
        <TextListItem component="dt">{name.charAt(0).toUpperCase() + name.slice(1)}</TextListItem>
        <TextListItem component="dd">{additionalInfo}</TextListItem>
      </React.Fragment>
    );
  };
  */

  const renderMeshLink = () => {
    if (config?.about?.mesh) {
      return (
        <Button component="a" href={config.about.mesh.url} variant={ButtonVariant.link} isInline>
          <IstioLogo className={iconStyle} />
          {config.about.mesh.linkText}
        </Button>
      );
    }

    return null;
  };

  const renderProjectLink = () => {
    if (config?.about?.project) {
      return (
        <Button component="a" href={config.about.project.url} variant={ButtonVariant.link} target="_blank" isInline>
          <KialiIcon.Repository className={iconStyle} />
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

  //const filteredServices = props.externalServices.filter(element => element.name !== TEMPO);
  //const componentList = filteredServices.map(externalService => renderComponent(externalService));
  //const tempoComponent = renderTempo(props.externalServices);

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
