import * as React from 'react';
import { AboutModal, TextContent, TextList, TextListItem, Title, Button, TitleSizes } from '@patternfly/react-core';
import { ExternalServiceInfo, Status, StatusKey } from '../../types/StatusState';
import { config, kialiLogo } from '../../config';
import { style } from 'typestyle';
import { KialiIcon } from 'config/KialiIcon';

type AboutUIModalState = {
  showModal: boolean;
};

type AboutUIModalProps = {
  status: Status;
  externalServices: ExternalServiceInfo[];
};

const iconStyle = style({
  marginRight: '10px'
});

class AboutUIModal extends React.Component<AboutUIModalProps, AboutUIModalState> {
  constructor(props: AboutUIModalProps) {
    super(props);
    this.state = { showModal: false };
  }

  open = () => {
    this.setState({ showModal: true });
  };

  close = () => {
    this.setState({ showModal: false });
  };

  render() {
    const coreVersion =
      this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === '' ||
      this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH] === 'unknown'
        ? this.props.status[StatusKey.KIALI_CORE_VERSION]
        : `${this.props.status[StatusKey.KIALI_CORE_VERSION]} (${this.props.status[StatusKey.KIALI_CORE_COMMIT_HASH]})`;
    const containerVersion = this.props.status[StatusKey.KIALI_CONTAINER_VERSION];

    return (
      <AboutModal
        isOpen={this.state.showModal}
        onClose={this.close}
        productName=""
        brandImageSrc={kialiLogo}
        brandImageAlt="Kiali Logo"
      >
        <TextContent>
          <TextList component="dl">
            <TextListItem key={'kiali-name'} component="dt">
              Kiali
            </TextListItem>
            <TextListItem key={'kiali-version'} component="dd">
              {coreVersion!}
            </TextListItem>
            <TextListItem key={'kiali-container-name'} component="dt">
              Kiali Container
            </TextListItem>
            <TextListItem key={'kiali-container-version'} component="dd">
              {containerVersion!}
            </TextListItem>
          </TextList>
          <Title headingLevel="h3" size={TitleSizes.xl} style={{ padding: '20px 0px 20px' }}>
            Components
          </Title>
          <TextList component="dl">
            {this.props.externalServices && this.props.externalServices.map(this.renderComponent)}
          </TextList>
          {this.renderWebsiteLink()}
          {this.renderProjectLink()}
        </TextContent>
      </AboutModal>
    );
  }

  private renderComponent = (externalService: ExternalServiceInfo) => {
    const name = externalService.version ? externalService.name : `${externalService.name} URL`;
    const additionalInfo = this.additionalComponentInfoContent(externalService);
    return (
      <React.Fragment key={name + additionalInfo}>
        <TextListItem component="dt">{name}</TextListItem>
        <TextListItem component="dd">{additionalInfo}</TextListItem>
      </React.Fragment>
    );
  };

  private additionalComponentInfoContent = (externalService: ExternalServiceInfo) => {
    if (!externalService.version && !externalService.url) {
      return 'N/A';
    }
    const version = externalService.version ? externalService.version : '';
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

  private renderWebsiteLink = () => {
    if (config.about && config.about.website) {
      return (
        // @ts-ignore
        <Button component="a" href={config.about.website.url} variant="link" target="_blank">
          <KialiIcon.Website className={iconStyle} />
          {config.about.website.linkText}
        </Button>
      );
    }

    return null;
  };

  private renderProjectLink = () => {
    if (config.about && config.about.project) {
      return (
        // @ts-ignore
        <Button component="a" href={config.about.project.url} variant="link" target="_blank">
          <KialiIcon.Repository className={iconStyle} />
          {config.about.project.linkText}
        </Button>
      );
    }

    return null;
  };
}

export default AboutUIModal;
