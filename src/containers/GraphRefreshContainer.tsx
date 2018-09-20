import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { KialiAppState } from '../store/Store';
import GraphRefresh from '../components/GraphFilter/GraphRefresh';
import { config } from '../config';

const mapStateToProps = (state: KialiAppState) => ({
  pollInterval: state.graph.filterState.refreshRate
});

const mapDispatchToProps = (dispatch: any) => {
  return {
    // TODO: We still need to reduxify namespace and duration to be able to use this
    // onUpdatePollInterval: bindActionCreators(GraphDataActions.fetchGraphData, dispatch),
    onUpdatePollInterval: bindActionCreators(GraphFilterActions.setRefreshRate, dispatch)
  };
};

const pollIntervalDefaults = config().toolbar.pollInterval;

const GraphRefreshWithDefaultOptions = props => {
  return <GraphRefresh options={pollIntervalDefaults} {...props} />;
};

const GraphRefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRefreshWithDefaultOptions);
export default GraphRefreshContainer;
