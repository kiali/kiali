import * as React from 'react';
import {
  isParentOwnedAppearance,
  observeDocumentAppearance,
  syncReduxAppearanceFromDocument
} from 'utils/AppearanceUtils';

/**
 * When embedded in the same window as OpenShift Console (OSSMC), keep Redux
 * appearance in sync with PF classes the console sets on <html>.
 * Does nothing in standalone Kiali or iframe embeds that own their document.
 */
export const ParentAppearanceSync: React.FC = () => {
  React.useEffect(() => {
    if (!isParentOwnedAppearance()) {
      return undefined;
    }

    // Initial sync in case classes changed between layout setup and mount.
    syncReduxAppearanceFromDocument();

    return observeDocumentAppearance(() => {
      syncReduxAppearanceFromDocument();
    });
  }, []);

  return null;
};
