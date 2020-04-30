import React from 'react';
import { style } from 'typestyle';
import { PfColors } from '../../Pf/PfColors';
import BreadcrumbView from '../../BreadcrumbView/BreadcrumbView';

const containerPadding = style({ padding: '0 20px 20px 20px' });
const containerWhite = style({ backgroundColor: PfColors.White });
// This magic style tries to adjust Breadcrumb with Namespace selector
// to give impression that both components are placed in the same location
const breadcrumbMargin = style({ padding: '16px 0 4px 0' });

interface RenderHeaderProps {
  location?: {
    pathname: string;
    search: string;
  };
}

export class RenderHeader extends React.Component<RenderHeaderProps> {
  render() {
    return (
      <div className={`${containerPadding} ${containerWhite}`}>
        {this.props.location && (
          <div className={breadcrumbMargin}>
            <BreadcrumbView location={this.props.location} />
          </div>
        )}
        {this.props.children}
      </div>
    );
  }
}
