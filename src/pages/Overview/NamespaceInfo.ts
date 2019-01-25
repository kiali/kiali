export type NamespaceInfo = {
  name: string;
  status?: NamespaceStatus;
};

export type NamespaceStatus = {
  inError: string[];
  inWarning: string[];
  inSuccess: string[];
  notAvailable: string[];
};

export default NamespaceInfo;
