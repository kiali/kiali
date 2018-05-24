import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { Link } from 'react-router-dom';

interface ServiceInfoRoutesProps {
  dependencies?: Map<string, string[]>;
}

class ServiceInfoRoutes extends React.Component<ServiceInfoRoutesProps> {
  constructor(props: ServiceInfoRoutesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {Object.keys(this.props.dependencies || new Map()).map((key, u) => (
              <div className="card-pf-body" key={'dependencies_' + u}>
                <div className="progress-description">
                  <strong>To: </strong> {key}
                </div>
                <ul style={{ listStyleType: 'none' }}>
                  {(this.props.dependencies ? this.props.dependencies[key] : []).map((dependency, i) => {
                    let nVersion = dependency.indexOf('/');
                    let nNamespace = dependency.indexOf('.');
                    let servicename = dependency.substring(0, nNamespace);
                    let namespace = dependency.substring(nNamespace + 1, nVersion);
                    if (servicename.length > 0 && namespace.length > 0) {
                      let to = '/namespaces/' + namespace + '/services/' + servicename;
                      return (
                        <Link key={to + key + dependency} to={to}>
                          <li key={'dependencies_' + u + '_dependency_' + i}>{dependency}</li>
                        </Link>
                      );
                    } else {
                      return <li key={'dependencies_' + u + '_dependency_' + i}>{dependency}</li>;
                    }
                  })}
                </ul>
              </div>
            ))}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoRoutes;
