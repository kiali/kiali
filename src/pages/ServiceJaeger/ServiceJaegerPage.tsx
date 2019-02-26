import * as React from 'react';
import Iframe from 'react-iframe';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { JaegerToolbar } from '../../components/JaegerToolbar';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { JaegerActions } from '../../actions/JaegerActions';

type ServiceJaegerProps = {
  url: string;
  setOptions: () => void;
};

class ServiceJaegerPage extends React.Component<ServiceJaegerProps> {
  constructor(props: ServiceJaegerProps) {
    super(props);
    this.props.setOptions();
  }

  render() {
    const { url } = this.props;
    return (
      <>
        <JaegerToolbar />
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
    setOptions: () => {
      dispatch(JaegerActions.setNamespace(''));
      dispatch(JaegerActions.setService(''));
      dispatch(JaegerActions.setTags(''));
      dispatch(JaegerActions.setLookback(3600));
      dispatch(JaegerActions.setDurations('', ''));
      dispatch(JaegerActions.setSearchRequest(''));
    }
  };
};

const ServiceJaegerPageContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ServiceJaegerPage);

export default ServiceJaegerPageContainer;
