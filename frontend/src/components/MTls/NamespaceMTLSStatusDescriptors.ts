import { MTLSStatuses } from 'types/TLSStatus';
import { PFColors } from 'components/Pf/PfColors';
import { StatusDescriptor } from './MTLSStatus';
import { MTLSIconTypes } from './MTLSIconTypes';

// Namespace-level mTLS status descriptors.
// This is shared by both:
// - `NamespaceMTLSStatus` (icon-only)
// - `NamespacesRenderers` (icon + label)
export const namespaceMTLSStatusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatuses.VALIDATION_ERROR,
    {
      message: 'mTLS PeerAuthentication has validation errors in this namespace',
      color: PFColors.Danger,
      name: 'Validation error',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED,
    {
      message: 'mTLS is enabled for this namespace',
      color: 'var(--pf-t--global--text--color--primary--default)',
      name: 'Strict',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED_EXTENDED,
    {
      message: 'mTLS is enabled for this namespace, extended from Mesh-wide config',
      color: 'var(--pf-t--global--text--color--primary--default)',
      name: 'Strict',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY,
    {
      message: 'mTLS is partially enabled for this namespace. Connection can be either plaintext or mTLS tunnel',
      name: 'Permissive',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.DISABLED,
    {
      message: 'mTLS is disabled for this namespace',
      color: PFColors.Danger,
      name: 'Disabled',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.UNSET,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide UNSET mTLS mode',
      backgroundColor: PFColors.Color200,
      color: PFColors.BackgroundColor100,
      name: 'Unset',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ],
  // No namespace policy; mesh/control plane is DISABLED — show "Unset" label with disabled-style icon.
  [
    MTLSStatuses.UNSET_INHERITED_DISABLED,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide DISABLED mTLS mode',
      backgroundColor: PFColors.Danger,
      color: PFColors.BackgroundColor100,
      name: 'Disabled',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.UNSET_INHERITED_PERMISSIVE,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide PERMISSIVE mTLS mode',
      backgroundColor: PFColors.Color200,
      color: PFColors.BackgroundColor100,
      name: 'Permissive',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ],
  // No namespace policy; mesh/control plane is STRICT — show "Unset" label with closed lock icon only.
  [
    MTLSStatuses.UNSET_INHERITED_STRICT,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide STRICT mTLS mode',
      backgroundColor: 'var(--pf-t--global--icon--color--regular)',
      color: PFColors.BackgroundColor100,
      name: 'Strict',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.UNSET_INHERITED_UNSET,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide UNSET mTLS mode',
      backgroundColor: PFColors.Color200,
      color: PFColors.BackgroundColor100,
      name: 'Unset',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ],
  // Backwards-compatibility: older backends may return MTLS_NOT_ENABLED for the "no policy" case.
  // Treat it as UNSET so the UI doesn't render an empty cell.
  [
    MTLSStatuses.NOT_ENABLED,
    {
      message: 'mTLS is UNSET for the namespace. Inheriting mesh-wide UNSET mTLS mode',
      backgroundColor: PFColors.Color200,
      color: PFColors.BackgroundColor100,
      name: 'Unset',
      icon: MTLSIconTypes.ARROW_DOWN,
      showStatus: true
    }
  ]
]);
