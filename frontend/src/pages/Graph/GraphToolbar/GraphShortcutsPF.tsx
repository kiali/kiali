import * as React from 'react';
import { Chip } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';

interface Shortcut {
  description: string;
  shortcut: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: 'Mouse wheel', description: t('Zoom graph') },
  { shortcut: 'Click + Drag', description: t('Pan graph, drag node') },
  { shortcut: 'Shift + Drag', description: t('Select zoom area') },
  { shortcut: 'Ctrl + Drag', description: t('Select zoom area') },
  { shortcut: 'Node Click', description: t('Select node + side panel') },
  { shortcut: 'Edge Click', description: t('Select edge + side panel') },
  { shortcut: 'Right Click', description: t('Menu of options') },
  { shortcut: 'Menu: Node Graph', description: t('Drill into node detail graph') }
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
