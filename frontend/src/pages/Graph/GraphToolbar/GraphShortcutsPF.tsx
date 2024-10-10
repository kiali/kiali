import * as React from 'react';
import { Chip } from '@patternfly/react-core';

interface Shortcut {
  description: string;
  shortcut: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: 'Mouse wheel', description: 'Zoom graph' },
  { shortcut: 'Click + Drag', description: 'Pan graph, drag node' },
  { shortcut: 'Node Click', description: 'Select node + side panel' },
  { shortcut: 'Edge Click', description: 'Select edge + side panel' },
  { shortcut: 'Right Click', description: 'Menu of options' },
  { shortcut: 'Menu: Node Graph', description: 'Drill into node detail graph' }
];

const makeShortcut = (shortcut: Shortcut): React.ReactNode => {
  return (
    <div style={{ display: 'flex', marginBottom: '10px' }}>
      <div style={{ flex: '45%' }}>
        <Chip isReadOnly>{shortcut.shortcut}</Chip>
      </div>

      <div style={{ flex: '55%' }}>{shortcut.description}</div>
    </div>
  );
};

export const GraphShortcutsPF = (): React.ReactNode => (
  <>
    {shortcuts.map(
      (s: Shortcut): React.ReactNode => {
        return makeShortcut(s);
      }
    )}
  </>
);
