import * as React from 'react';
import { ListGroup, ListGroupItem } from 'patternfly-react';

class ServiceListComponent extends React.Component {
  render() {
    return (
      <div>
        <ListGroup>
          <ListGroupItem bsStyle="success">Dapibus ac facilisis in</ListGroupItem>
          <ListGroupItem bsStyle="info">Cras sit amet nibh libero</ListGroupItem>
          <ListGroupItem bsStyle="warning">Porta ac consectetur ac</ListGroupItem>
          <ListGroupItem bsStyle="danger">Vestibulum at eros</ListGroupItem>
        </ListGroup>
      </div>
    );
  }
}

export default ServiceListComponent;
