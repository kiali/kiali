import React from 'react';
import { style } from 'typestyle';
import { PfColors } from '../../Pf/PfColors';
import BreadcrumbView from '../../BreadcrumbView/BreadcrumbView';

const containerPadding = style({ padding: '0 20px 20px 30px' });
const containerWhite = style({ backgroundColor: PfColors.White });

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
          <div style={{ marginBottom: '10px' }}>
            <BreadcrumbView location={this.props.location} />
          </div>
        )}
        {this.props.children}
      </div>
    );
  }
}
