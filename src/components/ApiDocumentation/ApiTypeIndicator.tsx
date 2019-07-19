import * as React from 'react';
import { style } from 'typestyle';

import apiGrpcIcon from '../../assets/img/api-grpc-logo.svg';
import apiRestIcon from '../../assets/img/api-rest-logo.svg';
import apiGraphqlIcon from '../../assets/img/api-graphql-logo.svg';

interface Props {
  apiType: string;
}

const nameToSource = new Map<string, string>([
  ['grpc', apiGrpcIcon],
  ['rest', apiRestIcon],
  ['graphql', apiGraphqlIcon],
]);

const iconStyle = style({
  marginTop: -2,
  marginRight: 6,
  width: 30
});

export class ApiTypeIndicator extends React.Component<Props> {

  render() {
    return this.props.apiType ? this.renderIcon(this.props.apiType) : <span />;
  }

  renderIcon(apiType: string) {
    let iconToRender = nameToSource.get(this.props.apiType);
    return iconToRender ? (
      <img
        className={iconStyle}
        src={iconToRender}
        alt={apiType}
      />
    ) : (
      <span />
    )
  }

}
