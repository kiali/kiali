import React from 'react';
import { Chip } from '@patternfly/react-core';

interface Shortcut {
  shortcut: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  {
    shortcut: $t('shortcuts.MouseWheel.shortcut', 'Mouse wheel'),
    description: $t('shortcuts.MouseWheel.description', 'Zoom')
  },
  {
    shortcut: $t('shortcuts.ClickDrag.shortcut', 'Click + Drag'),
    description: $t('shortcuts.ClickDrag.description', 'Panning')
  },
  {
    shortcut: $t('shortcuts.ShiftDrag.shortcut', 'Shift + Drag'),
    description: $t('shortcuts.ShiftDrag.description', 'Select zoom area')
  },
  {
    shortcut: $t('shortcuts.RightClick.shortcut', 'Right click'),
    description: $t('shortcuts.RightClick.description', 'Contextual menu on nodes')
  },
  {
    shortcut: $t('shortcuts.SingleClick.shortcut', 'Single click'),
    description: $t('shortcuts.SingleClick.description', 'Details in side panel on nodes and edges')
  },
  {
    shortcut: $t('shortcuts.DoubleClick.shortcut', 'Double click'),
    description: $t('shortcuts.DoubleClick.description', 'Drill into a node details graph')
  }
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
