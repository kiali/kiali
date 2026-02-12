import { kialiStyle } from 'styles/StyleUtils';

// info icon placement that triggers tooltip on hover
// TODO replace by helpIconStyle when tooltip is migrated to popover
export const infoStyle = kialiStyle({ marginLeft: '0.375rem' });

// help icon placement that triggers popover on hover
export const helpIconStyle = kialiStyle({ marginLeft: '0.5rem', cursor: 'pointer' });
