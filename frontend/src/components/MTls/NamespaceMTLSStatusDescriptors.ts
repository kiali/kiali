import { MTLSStatuses } from 'types/TLSStatus';
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
      color: 'red',
      name: 'Validation error',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED,
    {
      message: 'mTLS is enabled for this namespace',
      color: 'black',
      name: 'Strict',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED_EXTENDED,
    {
      message: 'mTLS is enabled for this namespace, extended from Mesh-wide config',
      color: 'black',
      name: 'Strict',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY,
    {
      message: 'mTLS is partially enabled for this namespace',
      color: 'grey',
      name: 'Permissive',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.DISABLED,
    {
      message: 'mTLS is disabled for this namespace',
      color: 'red',
      name: 'Disabled',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.UNSET,
    {
      message: 'mTLS is not modified by this namespace. Defaults to Mesh mTLS',
      color: 'black',
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ],
  // Backwards-compatibility: older backends may return MTLS_NOT_ENABLED for the "no policy" case.
  // Treat it as UNSET so the UI doesn't render an empty cell.
  [
    MTLSStatuses.NOT_ENABLED,
    {
      message: 'mTLS is not modified by this namespace. Defaults to Mesh mTLS',
      color: 'black',
      name: 'Unset',
      icon: MTLSIconTypes.LOCK_OPEN,
      showStatus: true
    }
  ]
]);
