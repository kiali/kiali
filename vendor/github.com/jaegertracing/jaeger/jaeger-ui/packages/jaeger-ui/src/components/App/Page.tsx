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

import * as React from 'react';
import { Layout } from 'antd';
import cx from 'classnames';
import Helmet from 'react-helmet';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import TopNav from './TopNav';
import { ReduxState } from '../../types';
import { EmbeddedState } from '../../types/embedded';
import { trackPageView } from '../../utils/tracking';

import './Page.css';

type TProps = RouteComponentProps<any> & {
  children: React.ReactNode;
  embedded: EmbeddedState;
  pathname: string;
  search: string;
};

const { Header, Content } = Layout;

// export for tests
export class PageImpl extends React.Component<TProps> {
  componentDidMount() {
    const { pathname, search } = this.props;
    trackPageView(pathname, search);
  }

  componentWillReceiveProps(nextProps: TProps) {
    const { pathname, search } = this.props;
    const { pathname: nextPathname, search: nextSearch } = nextProps;
    if (pathname !== nextPathname || search !== nextSearch) {
      trackPageView(nextPathname, nextSearch);
    }
  }

  render() {
    const { embedded } = this.props;
    const contentCls = cx({ 'Page--content': !embedded });
    return (
      <div>
        <Helmet title="Jaeger UI" />
        <Layout>
          {!embedded && (
            <Header className="Page--topNav">
              <TopNav />
            </Header>
          )}
          <Content className={contentCls}>{this.props.children}</Content>
        </Layout>
      </div>
    );
  }
}

// export for tests
export function mapStateToProps(state: ReduxState) {
  const { embedded } = state;
  const { pathname, search } = state.router.location;
  return { embedded, pathname, search };
}

export default withRouter(connect(mapStateToProps)(PageImpl));
