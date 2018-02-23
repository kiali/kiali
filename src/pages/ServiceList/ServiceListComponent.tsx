import * as React from 'react';
import { ListView, ListViewItem, ListViewIcon } from 'patternfly-react';
import { Link } from 'react-router-dom';

class ServiceListComponent extends React.Component {
  render() {
    return (
      <div>
        <ListView>
          <Link to={'/namespaces/istio-system/services/productpage'} style={{ color: 'black' }}>
            <ListViewItem
              key="productpage"
              leftContent={<ListViewIcon type="pf" name="service" />}
              heading={
                <span>
                  productpage
                  <small>istio-system</small>
                </span>
              }
              description={<span />}
            />
          </Link>
          <Link to={'/namespaces/istio-system/services/reviews'} style={{ color: 'black' }}>
            <ListViewItem
              key="reviews"
              leftContent={<ListViewIcon type="pf" name="service" />}
              heading={
                <span>
                  reviews
                  <small>istio-system</small>
                </span>
              }
              description={<span />}
            />
          </Link>
          <Link to={'/namespaces/istio-system/services/ratings'} style={{ color: 'black' }}>
            <ListViewItem
              key="ratings"
              leftContent={<ListViewIcon type="pf" name="service" />}
              heading={
                <span>
                  ratings
                  <small>istio-system</small>
                </span>
              }
              description={<span />}
            />
          </Link>
          <Link to={'/namespaces/istio-system/services/details'} style={{ color: 'black' }}>
            <ListViewItem
              key="details"
              leftContent={<ListViewIcon type="pf" name="service" />}
              heading={
                <span>
                  details
                  <small>istio-system</small>
                </span>
              }
              description={<span />}
            />
          </Link>
        </ListView>
      </div>
    );
  }
}

export default ServiceListComponent;
