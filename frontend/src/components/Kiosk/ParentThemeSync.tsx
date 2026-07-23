import * as React from 'react';
import { isParentOwnedTheme, observeDocumentTheme, syncReduxThemeFromDocument } from 'utils/ThemeUtils';

/**
 * When embedded in the same window as OpenShift Console (OSSMC), keep Redux
 * theme/contrastMode in sync with PF classes the console sets on <html>.
 * Does nothing in standalone Kiali or iframe embeds that own their document.
 */
export const ParentThemeSync: React.FC = () => {
  React.useEffect(() => {
    if (!isParentOwnedTheme()) {
      return undefined;
    }

    // Initial sync in case classes changed between layout setup and mount.
    syncReduxThemeFromDocument();

    return observeDocumentTheme(() => {
      syncReduxThemeFromDocument();
    });
  }, []);

  return null;
};
