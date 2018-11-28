import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { Link } from 'react-router-dom';

export interface Route {
  name: string;
  namespace: string;
}

interface ServiceInfoRoutesProps {
  direction: string;
  resourceUrl: string;
  dependencies?: { [key: string]: Route[] };
}

class InfoRoutes extends React.Component<ServiceInfoRoutesProps> {
  constructor(props: ServiceInfoRoutesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {Object.keys(this.props.dependencies || {}).map((key, u) => (
              <div className="card-pf-body" key={'dependencies_' + u}>
                <div className="progress-description">
                  <strong>{this.props.direction}: </strong> {key}
                </div>
                <ul style={{ listStyleType: 'none' }}>
                  {(this.props.dependencies ? this.props.dependencies[key] : []).map((dependency, i) => {
                    if (dependency.name !== 'unknown' && dependency.namespace !== 'unknown') {
                      const to = `/namespaces/${dependency.namespace}/${this.props.resourceUrl}/${dependency.name}`;
                      return (
                        <li key={'dependencies_' + u + '_dependency_' + i}>
                          <Link key={key + to} to={to}>
                            {dependency.name}
                          </Link>
                        </li>
                      );
                    } else {
                      return <li key={'dependencies_' + u + '_dependency_' + i}>{dependency.name}</li>;
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

export default InfoRoutes;
