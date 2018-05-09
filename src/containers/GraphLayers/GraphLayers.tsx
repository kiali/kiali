import * as React from 'react';
import Switch from 'react-bootstrap-switch';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { serviceGraphFilterActions } from '../../actions/ServiceGraphFilterActions';
import { KialiAppState, ServiceGraphFilterState } from '../../store/Store';
import { style } from 'typestyle';

interface ServiceGraphDispatch {
  // Dispatch methods
  toggleGraphEdgeLabels(): void;
  toggleGraphNodeLabels(): void;
  toggleGraphCircuitBreakers(): void;
  toggleGraphRouteRules(): void;
}

// inherit all of our Reducer state section  and Dispatch methods for redux
type GraphLayersProps = ServiceGraphDispatch & ServiceGraphFilterState;

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showEdgeLabels: state.serviceGraphFilterState.showEdgeLabels,
  showNodeLabels: state.serviceGraphFilterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraphFilterState.showCircuitBreakers,
  showRouteRules: state.serviceGraphFilterState.showRouteRules
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleGraphNodeLabels: bindActionCreators(serviceGraphFilterActions.toggleGraphNodeLabel, dispatch),
    toggleGraphEdgeLabels: bindActionCreators(serviceGraphFilterActions.toggleGraphEdgeLabel, dispatch),
    toggleGraphCircuitBreakers: bindActionCreators(serviceGraphFilterActions.toggleGraphCircuitBreakers, dispatch),
    toggleGraphRouteRules: bindActionCreators(serviceGraphFilterActions.toggleGraphRouteRules, dispatch)
  };
};

// Show/Hide Graph Visibility Layers -- there will be many
// Right now it is a toolbar with Switch Buttons -- this will change once with UXD input
class GraphLayers extends React.Component<GraphLayersProps, null> {
  constructor(props: GraphLayersProps) {
    super(props);
  }

  render() {
    const switchButtonStyle = style({
      paddingLeft: '10px'
    });

    return (
      <>
        <span className={switchButtonStyle}>
          <Switch
            bsSize={'medium'}
            labelText={'Circuit Breakers'}
            value={this.props.showCircuitBreakers}
            disabled={false}
            onChange={(el, state) => this.props.toggleGraphCircuitBreakers()}
          />
        </span>
        <span className={switchButtonStyle}>
          <Switch
            bsSize={'medium'}
            labelText={'Route Rules'}
            value={this.props.showRouteRules}
            disabled={false}
            onChange={(el, state) => this.props.toggleGraphRouteRules()}
          />
        </span>
        <span className={switchButtonStyle}>
          <Switch
            bsSize={'medium'}
            labelText={'Edge Labels'}
            value={this.props.showEdgeLabels}
            onChange={(el, state) => this.props.toggleGraphEdgeLabels()}
          />
        </span>
        <span className={switchButtonStyle}>
          <Switch
            bsSize={'medium'}
            labelText={'Node Labels'}
            value={this.props.showNodeLabels}
            onChange={(el, state) => this.props.toggleGraphNodeLabels()}
          />
        </span>
      </>
    );
  }
}

// hook up to Redux for our State to be mapped to props
const GraphLayersConnected = connect(mapStateToProps, mapDispatchToProps)(GraphLayers);
export default GraphLayersConnected;
