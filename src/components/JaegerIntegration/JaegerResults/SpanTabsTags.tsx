import * as React from 'react';
import { Tab, Tabs } from '@patternfly/react-core';
import { Span } from '../../../types/JaegerInfo';
import { SpanTags } from './SpanTags';

interface SpanTabsTagsProps {
  span: Span;
}

interface SpanTabsTagsState {
  activeTabKey: number;
}

export class SpanTabsTags extends React.Component<SpanTabsTagsProps, SpanTabsTagsState> {
  constructor(props: SpanTabsTagsProps) {
    super(props);
    this.state = {
      activeTabKey: 0
    };
  }

  handleTabClick = (_, tabIndex) => {
    this.setState({
      activeTabKey: tabIndex
    });
  };

  render() {
    const processTags = this.props.span.process.tags;
    return (
      <Tabs isFilled activeKey={this.state.activeTabKey} onSelect={this.handleTabClick}>
        <Tab eventKey={0} title="Tags">
          <div style={{ overflowY: 'scroll', height: '300px' }}>
            <SpanTags label={'Tags'} tags={this.props.span.tags} />
          </div>
        </Tab>
        {processTags && (
          <Tab eventKey={1} title="Process Tags">
            <div style={{ overflowY: 'scroll', height: '300px' }}>
              <SpanTags label={'Process'} tags={processTags} />
            </div>
          </Tab>
        )}
      </Tabs>
    );
  }
}
