import React from 'react';
import { Chip } from '@patternfly/react-core';

interface Shortcut {
  shortcut: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: 'MouseWheel', description: 'Zoom' },
  { shortcut: 'ClickDrag', description: 'Panning' },
  { shortcut: 'ShiftDrag', description: 'SelectZoomArea' },
  { shortcut: 'RightClick', description: 'description14' },
  { shortcut: 'SingleClick', description: 'description15' },
  { shortcut: 'DoubleClick', description: 'description16' }
];

const makeShortcut = (shortcut: Shortcut): JSX.Element => {
  return (
    <div style={{ display: 'flex', marginBottom: '10px' }}>
      <div style={{ flex: '40%' }}>
        <Chip isReadOnly>{$t(shortcut.shortcut)}</Chip>
      </div>
      <div style={{ flex: '60%' }}>{$t(shortcut.description)}</div>
    </div>
  );
};

export const GraphShortcuts = (): JSX.Element => (
  <>
    {shortcuts.map(
      (s: Shortcut): JSX.Element => {
        return makeShortcut(s);
      }
    )}
  </>
);
