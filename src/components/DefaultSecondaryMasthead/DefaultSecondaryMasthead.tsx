import React from 'react';
import { Title } from '@patternfly/react-core';
import NamespaceDropdownContainer from '../NamespaceDropdown';
import { style } from 'typestyle';

const titles = [
  'applications',
  'workloads',
  'services',
  'istio',
  'istio/new',
  'extensions/iter8',
  'extensions/iter8/new',
  'extensions/iter8/newfromfile'
];

type Props = {
  rightToolbar?: JSX.Element;
  actionsToolbar?: JSX.Element;
};

const mainPadding = style({
  padding: '10px 20px 10px 20px'
});

const flexStyle = style({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = style({
  marginLeft: 'auto'
});

const actionsToolbarStyle = style({
  marginLeft: 'auto',
  paddingTop: '17px'
});

export default class DefaultSecondaryMasthead extends React.Component<Props> {
  showTitle() {
    let path = window.location.pathname;
    path = path.substr(path.lastIndexOf('/console') + '/console'.length + 1);
    if (titles.includes(path)) {
      let title = path.charAt(0).toUpperCase() + path.slice(1);
      let disabled = false;
      if (path === 'istio/new') {
        title = 'Create New Istio Config';
      } else if (path === 'istio') {
        title = 'Istio Config';
      } else if (path === 'extensions/iter8') {
        title = 'Iter8 Experiments';
      } else if (path === 'extensions/iter8/new') {
        title = 'Create New Iter8 Experiment';
        disabled = true;
      } else if (path === 'extensions/iter8/newfromfile') {
        title = 'Create New Iter8 Experiment from File';
      }
      return {
        title: (
          <Title headingLevel="h1" size="3xl" style={{ margin: '15px 0 11px' }}>
            {title}
          </Title>
        ),
        disabled: disabled
      };
    }

    return { title: undefined, disabled: false };
  }

  render() {
    const { title, disabled } = this.showTitle();
    return (
      <div className={mainPadding}>
        <div className={flexStyle}>
          <div>
            <NamespaceDropdownContainer disabled={disabled} />
          </div>
          {this.props.rightToolbar && <div className={rightToolbarStyle}>{this.props.rightToolbar}</div>}
        </div>
        <div className={flexStyle}>
          <div>{title}</div>
          {this.props.actionsToolbar && <div className={actionsToolbarStyle}>{this.props.actionsToolbar}</div>}
        </div>
      </div>
    );
  }
}
