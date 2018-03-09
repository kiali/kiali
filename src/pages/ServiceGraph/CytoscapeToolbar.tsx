import * as React from 'react';
import { ButtonGroup, Button } from 'patternfly-react';
import PropTypes from 'prop-types';

type CytoscapeToolbarProps = {
  graphType: PropTypes.func;
};

type CytoscapeToolbarState = {
  // none
};

class CytoscapeToolbar extends React.Component<CytoscapeToolbarProps, CytoscapeToolbarState> {
  constructor(props: CytoscapeToolbarProps) {
    super(props);
  }

  dagre = () => {
    this.props.graphType('Dagre');
  };

  cola = () => {
    this.props.graphType('Cola');
  };

  breadthFirst = () => {
    this.props.graphType('Breadthfirst');
  };

  render() {
    return (
      <ButtonGroup>
        <Button onClick={this.cola}>Cola</Button>
        <Button onClick={this.dagre}>Dagre</Button>
        <Button onClick={this.breadthFirst}>Breadthfirst</Button>
      </ButtonGroup>
    );
  }
}

export default CytoscapeToolbar;
