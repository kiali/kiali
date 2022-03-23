export enum MTLSStatuses {
  ENABLED = 'MTLS_ENABLED',
  PARTIALLY = 'MTLS_PARTIALLY_ENABLED',
  NOT_ENABLED = 'MTLS_NOT_ENABLED',
  DISABLED = 'MTLS_DISABLED'
}

export interface TLSStatus {
  status: string;
}

export const nsWideMTLSStatus = (nsStatus: string, meshStatus: string): string => {
  let finalStatus = nsStatus;

  // When mTLS is enabled meshwide but not disabled at ns level
  // Then the ns has mtls enabled
  if (meshStatus === MTLSStatuses.ENABLED && nsStatus === MTLSStatuses.NOT_ENABLED) {
    finalStatus = MTLSStatuses.ENABLED;
  }

  return finalStatus;
};

export const isMTLSEnabled = (status: string): boolean => {
  return status === MTLSStatuses.ENABLED;
};
