import * as React from 'react';
import { JaegerToolbar } from './JaegerToolbar';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { JaegerSearchOptions, JaegerURLSearch } from './RouteHelper';
import JaegerTracesIframe from './JaegerTracesIframe';
import { RenderHeader } from '../Nav/Page';

interface JaegerIntegrationProps {
  disableSelectorNs?: boolean;
  namespaceSelector: boolean;
  tagsValue?: string;
  serviceSelected?: string;
  urlJaeger: string;
}

interface JaegerIntegrationState {
  url: string;
}

export class JaegerIntegration extends React.Component<JaegerIntegrationProps, JaegerIntegrationState> {
  constructor(props: JaegerIntegrationProps) {
    super(props);
    this.state = { url: '' };
  }

  updateURL = (options: JaegerSearchOptions) => {
    const url = new JaegerURLSearch(this.props.urlJaeger);
    this.setState({ url: url.createRoute(options) });
  };

  render() {
    const { disableSelectorNs, namespaceSelector, serviceSelected, tagsValue } = this.props;

    return (
      <>
        <RenderHeader>
          <JaegerToolbar
            updateURL={this.updateURL}
            serviceSelected={serviceSelected}
            tagsValue={tagsValue}
            disableSelectorNs={disableSelectorNs}
            namespaceSelector={namespaceSelector}
          />
        </RenderHeader>
        <JaegerTracesIframe url={this.state.url} />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    urlJaeger: state.jaegerState ? state.jaegerState.jaegerURL : '',
    namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true
  };
};

export const JaegerIntegrationContainer = connect(mapStateToProps)(JaegerIntegration);
