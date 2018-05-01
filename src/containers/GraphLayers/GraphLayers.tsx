import * as React from 'react';
import Switch from 'react-bootstrap-switch';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { serviceGraphActions } from '../../actions/ServiceGraphActions';
import { KialiAppState } from '../../store/Store';

interface LabelFilterProps {
  showEdgeLabels: boolean;
  showNodeLabels: boolean;

  toggleGraphEdgeLabels(): void;
  toggleGraphNodeLabels(): void;
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  showEdgeLabels: state.serviceGraphState.showEdgeLabels,
  showNodeLabels: state.serviceGraphState.showNodeLabels
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: any) => {
  return {
    toggleGraphNodeLabels: bindActionCreators(serviceGraphActions.toggleGraphNodeLabel, dispatch),
    toggleGraphEdgeLabels: bindActionCreators(serviceGraphActions.toggleGraphEdgeLabel, dispatch)
  };
};

class GraphLayers extends React.Component<LabelFilterProps, null> {
  constructor(props: LabelFilterProps) {
    super(props);
  }

  render() {
    return (
      <>
        <span style={{ marginLeft: 10 }}>
          <Switch
            bsSize={'medium'}
            labelText={'Edge Labels'}
            defaultValue={false}
            onChange={(el, state) => this.props.toggleGraphEdgeLabels()}
          />
        </span>
        <span style={{ marginLeft: 5 }}>
          <Switch
            bsSize={'medium'}
            labelText={'Node Labels'}
            defaultValue={true}
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
