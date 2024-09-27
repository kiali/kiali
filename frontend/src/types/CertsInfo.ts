export interface CertsInfo {
  accessible: boolean;
  configMapName: string;
  dnsNames: String[];
  error: string;
  issuer: string;
  notAfter: string;
  notBefore: string;
  subject: string;
}
