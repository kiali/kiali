// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { Component } from 'react';
import { Tabs } from 'antd';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DAG from './DAG';
import DependencyForceGraph from './DependencyForceGraph';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import * as jaegerApiActions from '../../actions/jaeger-api';
import { FALLBACK_DAG_MAX_NUM_SERVICES } from '../../constants';
import { nodesPropTypes, linksPropTypes } from '../../propTypes/dependencies';
import { formatDependenciesAsNodesAndLinks } from '../../selectors/dependencies';
import { getConfigValue } from '../../utils/config/get-config';

import './index.css';

const TabPane = Tabs.TabPane;

// export for tests
export const GRAPH_TYPES = {
  FORCE_DIRECTED: { type: 'FORCE_DIRECTED', name: 'Force Directed Graph' },
  DAG: { type: 'DAG', name: 'DAG' },
};

const dagMaxNumServices = getConfigValue('dependencies.dagMaxNumServices') || FALLBACK_DAG_MAX_NUM_SERVICES;

// export for tests
export class DependencyGraphPageImpl extends Component {
  static propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    dependencies: PropTypes.any.isRequired,
    fetchDependencies: PropTypes.func.isRequired,
    nodes: nodesPropTypes,
    links: linksPropTypes,
    loading: PropTypes.bool.isRequired,
    // eslint-disable-next-line react/forbid-prop-types
    error: PropTypes.object,
  };

  static defaultProps = {
    nodes: null,
    links: null,
    error: null,
  };

  constructor(props) {
    super(props);
    this.state = {
      graphType: 'FORCE_DIRECTED',
    };
  }

  componentWillMount() {
    this.props.fetchDependencies();
  }

  handleGraphTypeChange = graphType => this.setState({ graphType });

  render() {
    const { nodes, links, error, dependencies, loading } = this.props;
    const { graphType } = this.state;
    if (loading) {
      return <LoadingIndicator className="u-mt-vast" centered />;
    }
    if (error) {
      return <ErrorMessage className="ub-m3" error={error} />;
    }

    if (!nodes || !links) {
      return <div className="u-simple-card ub-m3">No service dependencies found.</div>;
    }

    const GRAPH_TYPE_OPTIONS = [GRAPH_TYPES.FORCE_DIRECTED];

    if (dependencies.length <= dagMaxNumServices) {
      GRAPH_TYPE_OPTIONS.push(GRAPH_TYPES.DAG);
    }

    return (
      <Tabs
        onChange={this.handleGraphTypeChange}
        activeKey={graphType}
        type="card"
        tabBarStyle={{ background: '#f5f5f5', padding: '1rem 1rem 0 1rem' }}
      >
        {GRAPH_TYPE_OPTIONS.map(opt => (
          <TabPane className="ub-relelative" tab={opt.name} key={opt.type}>
            <div className="DependencyGraph--graphWrapper">
              {opt.type === 'FORCE_DIRECTED' && <DependencyForceGraph nodes={nodes} links={links} />}
              {opt.type === 'DAG' && <DAG serviceCalls={dependencies} />}
            </div>
          </TabPane>
        ))}
      </Tabs>
    );
  }
}

// export for tests
export function mapStateToProps(state) {
  const { dependencies, error, loading } = state.dependencies;
  let links;
  let nodes;
  if (dependencies && dependencies.length > 0) {
    const formatted = formatDependenciesAsNodesAndLinks({ dependencies });
    links = formatted.links;
    nodes = formatted.nodes;
  }
  return { loading, error, nodes, links, dependencies };
}

// export for tests
export function mapDispatchToProps(dispatch) {
  const { fetchDependencies } = bindActionCreators(jaegerApiActions, dispatch);
  return { fetchDependencies };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DependencyGraphPageImpl);
