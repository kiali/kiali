export interface CertsInfo {
  accessible: boolean;
  configMapName: string;
  dnsNames: string[];
  error: string;
  issuer: string;
  notAfter: string;
  notBefore: string;
}
