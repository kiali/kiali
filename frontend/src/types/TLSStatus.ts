export enum MTLSStatuses {
  ENABLED = 'MTLS_ENABLED',
  ENABLED_DEFAULT = 'MTLS_ENABLED_DEFAULT',
  ENABLED_EXTENDED = 'MTLS_ENABLED_EXTENDED',
  PARTIALLY = 'MTLS_PARTIALLY_ENABLED',
  PARTIALLY_DEFAULT = 'MTLS_PARTIALLY_ENABLED_DEFAULT',
  AUTO_DEFAULT = 'AUTO_MTLS_DEFAULT',
  NOT_ENABLED = 'MTLS_NOT_ENABLED',
  DISABLED = 'MTLS_DISABLED'
}

export interface TLSStatus {
  autoMTLSEnabled: boolean;
  cluster?: string;
  minTLS: string;
  namespace?: string;
  status: string;
}

export const nsWideMTLSStatus = (nsStatus: string, meshStatus: string): string => {
  let finalStatus = nsStatus;

  // When mTLS is enabled meshwide but not disabled at ns level
  // Then the ns has mtls enabled
  if (meshStatus === MTLSStatuses.ENABLED && nsStatus === MTLSStatuses.NOT_ENABLED) {
    finalStatus = MTLSStatuses.ENABLED_EXTENDED;
  }

  return finalStatus;
};
