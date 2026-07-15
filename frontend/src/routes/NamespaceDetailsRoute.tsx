import * as React from 'react';
import { useParams } from 'react-router';
import { NamespaceDetailsPage } from 'pages/NamespaceDetails/NamespaceDetailsPage';

/**
 * Wrapper to inject route params into NamespaceDetailsPage (same pattern as WorkloadDetailsRoute).
 */
export const NamespaceDetailsRoute: React.FC = () => {
  const { namespace } = useParams<{ namespace: string }>();

  if (!namespace) {
    return null;
  }

  return <NamespaceDetailsPage namespace={namespace} />;
};
