import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';

interface Shortcut {
  description: string;
  shortcut: string;
}

const shortcuts: Shortcut[] = [
  { shortcut: t('Mouse wheel'), description: t('Zoom') },
  { shortcut: t('Click + Drag'), description: t('Panning') },
  { shortcut: 'Shift + Drag', description: t('Select zoom area') },
  { shortcut: 'Ctrl + Drag', description: t('Select zoom area') },
  // { shortcut: t('Right click'), description: t('Contextual menu on nodes') },
  { shortcut: t('Single click'), description: t('Details in side panel on nodes') }
];

const makeShortcut = (shortcut: Shortcut): React.ReactNode => {
  return (
    <div style={{ display: 'flex', marginBottom: '10px' }}>
      <div style={{ flex: '40%' }}>
        <Label variant="outline" >{t(shortcut.shortcut)}</Label>
      </div>
      <div style={{ flex: '60%' }}>{t(shortcut.description)}</div>
    </div>
  );
};

export const MeshShortcuts = (): React.ReactNode => (
  <>
    {shortcuts.map(
      (s: Shortcut): React.ReactNode => {
        return makeShortcut(s);
      }
    )}
  </>
);
