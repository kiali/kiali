import * as React from 'react';
import { JaegerToolbar } from './JaegerToolbar';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { JaegerSearchOptions, JaegerURLSearch } from './RouteHelper';
import JaegerTracesIframe from './JaegerTracesIframe';

interface JaegerIntegrationProps {
  disableSelectorNs?: boolean;
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
    const { serviceSelected, tagsValue, disableSelectorNs } = this.props;

    return (
      <div style={{ marginTop: '10px' }}>
        <JaegerToolbar
          updateURL={this.updateURL}
          serviceSelected={serviceSelected}
          tagsValue={tagsValue}
          disableSelectorNs={disableSelectorNs}
        />
        <JaegerTracesIframe url={this.state.url} />
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    urlJaeger: state.jaegerState ? state.jaegerState.jaegerURL : ''
  };
};

export const JaegerIntegrationContainer = connect(mapStateToProps)(JaegerIntegration);
