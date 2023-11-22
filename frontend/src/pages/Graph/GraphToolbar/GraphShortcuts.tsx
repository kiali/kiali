import React from 'react';
import { Chip } from '@patternfly/react-core';

interface Shortcut {
  shortcut: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: $t('MouseWheel', 'Mouse wheel'), description: $t('Zoom') },
  { shortcut: $t('ClickDrag', 'Click + Drag'), description: $t('Panning') },
  { shortcut: $t('ShiftDrag', 'Shift + Drag'), description: $t('SelectZoomArea', 'Select zoom area') },
  { shortcut: $t('RightClick', 'Right click'), description: $t('description14', 'Contextual menu on nodes') },
  {
    shortcut: $t('SingleClick', 'Single click'),
    description: $t('description15', 'Details in side panel on nodes and edges')
  },
  { shortcut: $t('DoubleClick', 'Double click'), description: $t('description16', 'Drill into a node details graph') }
];

const makeShortcut = (shortcut: Shortcut): JSX.Element => {
  return (
    <div style={{ display: 'flex', marginBottom: '10px' }}>
      <div style={{ flex: '40%' }}>
        <Chip isReadOnly>{shortcut.shortcut}</Chip>
      </div>
      <div style={{ flex: '60%' }}>{shortcut.description}</div>
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
