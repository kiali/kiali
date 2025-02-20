import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';
import { store } from '../../../store/ConfigStore';
import { isKiosk } from '../../Kiosk/KioskActions';

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
const TOP_PADDING = 76 + 118;

// EMBEDDED_PADDING constant is a magic number used to adjust the height of the main div to allow scrolling in the inner container layer.
// 42px is the height of the first tab menu
const EMBEDDED_PADDING = 42;

/**
 * By default, Kiali hides the global scrollbar and fixes the height for some pages to force the scrollbar to appear
 * Hiding global scrollbar is not possible when Kiali is embedded in other application (like Openshift Console)
 * In these cases height is not fixed to avoid multiple scrollbars (https://github.com/kiali/kiali/issues/6601)
 * GLOBAL_SCROLLBAR environment variable is not defined in standalone Kiali application (value is always false)
 */
const globalScrollbar = process.env.GLOBAL_SCROLLBAR ?? 'false';

const componentStyle = kialiStyle({
  padding: '1.25rem'
});

interface Props {
  className?: any;
  onResize?: (height: number) => void;
}

interface State {
  height: number;
}

export class RenderComponentScroll extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { height: 0 };
  }

  componentDidMount(): void {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount(): void {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = (): void => {
    const isStandalone = !isKiosk(store.getState().globalState.kiosk);
    const topPadding = isStandalone ? TOP_PADDING : EMBEDDED_PADDING;

    this.setState(
      {
        height: window.innerHeight - topPadding
      },
      () => {
        if (this.props.onResize) {
          this.props.onResize(this.state.height);
        }
      }
    );
  };

  render(): React.ReactNode {
    let scrollStyle = {};

    // If there is no global scrollbar, height is fixed to force the scrollbar to appear in the component
    if (globalScrollbar === 'false') {
      scrollStyle = { height: this.state.height, overflowY: 'auto', width: '100%' };
    }

    return (
      <div style={scrollStyle} className={classes(componentStyle, this.props.className)}>
        {this.props.children}
      </div>
    );
  }
}
