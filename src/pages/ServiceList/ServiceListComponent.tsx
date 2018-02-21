import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon, Button } from 'patternfly-react';
import { Link } from 'react-router-dom';

class ServiceListComponent extends React.Component {
  render() {
    return (
      <div>
        <ListView>
          <ListViewItem
            key="Product Page"
            leftContent={<ListViewIcon name="plane" />}
            heading={
              <span>
                Product Page
                <small>Feb 23, 2015 12:32 am</small>
              </span>
            }
            actions={
              <div>
                <Link to={'/namespaces/istio-system/services/ProductPage'}>
                  <Button>Details</Button>
                </Link>
              </div>
            }
            description={<span />}
          />
        </ListView>
      </div>
    );
  }
}

export default ServiceListComponent;
