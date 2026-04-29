import { kialiStyle } from './StyleUtils';

// Flex column that fills its parent. Tab content areas and similar
// containers use this to participate in the page flex chain.
export const flexFillStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

// Propagates the flex chain through a PF Card and its CardBody so child
// content (tables, dashboards, editors) gets a constrained height.
export const flexCardStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  $nest: {
    '& > .pf-v6-c-card__body': {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      minHeight: 0
    }
  }
});

// Overrides the default min-height:auto on flex items so the element
// constrains its children instead of growing to fit.
export const constrainedScrollStyle = kialiStyle({
  minHeight: 0
});

// Prevents a flex item from shrinking when sibling content grows.
// Useful for toolbars, alerts, and other fixed-height chrome.
export const noShrinkStyle = kialiStyle({
  flexShrink: 0
});

// Top margin for Cards rendered inside tab content areas.
export const tabCardStyle = kialiStyle({
  marginTop: '1rem'
});

// Scrollable flex child for use inside a CardBody or similar container.
// Must be a flex container itself so children with flex:1 are constrained
// to the available height rather than growing with their content.
export const scrollableContentStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  overflowY: 'auto'
});
