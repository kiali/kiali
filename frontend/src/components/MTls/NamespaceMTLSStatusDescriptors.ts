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
      message: 'Inherit from parent, if has one. Otherwise treated as PERMISSIVE',
      color: 'var(--pf-t--global--text--color--primary--default)',
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  // No namespace policy; mesh/control plane is DISABLED — show "Unset" label with disabled-style icon.
  [
    MTLSStatuses.UNSET_INHERITED_DISABLED,
    {
      message: 'No mTLS policy in this namespace; inherited Disabled from mesh',
      color: PFColors.Danger,
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  // No namespace policy; mesh/control plane is STRICT — show "Unset" label with closed lock icon only.
  [
    MTLSStatuses.UNSET_INHERITED_STRICT,
    {
      message: 'No mTLS policy in this namespace; inherited Strict from mesh',
      color: 'var(--pf-t--global--text--color--primary--default)',
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  // Backwards-compatibility: older backends may return MTLS_NOT_ENABLED for the "no policy" case.
  // Treat it as UNSET so the UI doesn't render an empty cell.
  [
    MTLSStatuses.NOT_ENABLED,
    {
      message: 'mTLS is not modified by this namespace. Defaults to Mesh mTLS',
      color: 'var(--pf-t--global--text--color--primary--default)',
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ]
]);
