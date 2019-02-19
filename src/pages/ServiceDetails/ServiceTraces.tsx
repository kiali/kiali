import * as React from 'react';
import Iframe from 'react-iframe';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { JaegerToolbar } from '../../components/JaegerToolbar';
import { JaegerActions } from '../../actions/JaegerActions';
import { JaegerThunkActions } from '../../actions/JaegerThunkActions';

interface ServiceTracesProps {
  namespace: string;
  service: string;
  url: string;
  setOptions: (ns: string, service: string) => void;
}

class ServiceTraces extends React.Component<ServiceTracesProps> {
  constructor(props: ServiceTracesProps) {
    super(props);
  }

  componentDidMount = () => {
    this.props.setOptions(this.props.namespace, this.props.service);
  };

  render() {
    const { url } = this.props;

    return (
      <>
        <JaegerToolbar tagsValue={'error=true'} disableSelector={true} />
        <div className="container-fluid container-cards-pf" style={{ height: 'calc(100vh - 100px)' }}>
          <Iframe id={'jaeger-iframe'} url={url} position="inherit" allowFullScreen={true} />
        </div>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    url: state.jaegerState.search.url
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setOptions: (namespace: string, service: string) => {
      dispatch(JaegerActions.setNamespace(namespace));
      dispatch(JaegerActions.setService(service));
      dispatch(JaegerActions.setTags('error=true'));
      dispatch(JaegerActions.setLookback('1h'));
      dispatch(JaegerActions.setDurations('', ''));
      dispatch(JaegerThunkActions.getSearchURL());
    }
  };
};

const ServiceTracesContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ServiceTraces);

export default ServiceTracesContainer;
