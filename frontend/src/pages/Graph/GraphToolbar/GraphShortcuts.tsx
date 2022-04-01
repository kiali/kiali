// TODO:  I know this looks bad but for JSX bodycontent we need the fix or
//        workaround for https://github.com/patternfly/patternfly-react/issues/7162

import React from 'react';
// import { Chip } from '@patternfly/react-core';

interface Shortcut {
  shortcut: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: 'Mouse Wheel', description: 'Zoom' },
  { shortcut: 'Click + Drag', description: 'Pan' },
  { shortcut: 'Shift + Drag', description: 'Select zoom area' },
  { shortcut: 'Right click', description: 'Context menu for node' },
  { shortcut: 'Single click', description: 'Side-panel details for node or edge' },
  { shortcut: 'Double click', description: 'Drill into a node detail graph' }
];

/*
const makeShortcut = (shortcut: Shortcut) => {
  return (
    <span>
        <div>{shortcut.shortcut}</div>
        <div>{shortcut.description}</div>
    </span>
  );
};
*/

const GraphShortcuts = (): React.ReactNode => {
  const rows = shortcuts.map(s => (
    <tr style={{ borderTop: '1px solid #ddd' }}>
      <td>{s.shortcut}</td>
      <td>{s.description}</td>
    </tr>
  ));
  return <table>{rows}</table>;
};

/*
const GraphShortcuts = (): JSX.Element => (
  <>
    {shortcuts.map(
      (s: Shortcut): JSX.Element => {
        return makeShortcut(s);
      }
    )}
  </>
);
*/

export default GraphShortcuts;
