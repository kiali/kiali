import { Namespace } from './Namespace';
import { ResourcePermissions } from './Permissions';
import { ObjectValidation, IstioObject, References, HelpMessage, K8sResource } from './IstioObjects';
import { AceOptions } from 'react-ace/types';

export type IstioConfigId = {
  namespace: string;
  objectGroup: string;
  objectKind: string;
  objectName: string;
  objectVersion: string;
};

export interface IstioConfigDetails {
  cluster?: string;
  help?: HelpMessage[];
  namespace: Namespace;
  permissions: ResourcePermissions;
  references?: References;
  resource: K8sResource;
  validation: ObjectValidation;
}

export interface IstioConfigDetailsQuery {
  help?: boolean;
  validate?: boolean;
}

export const aceOptions: AceOptions = {
  autoScrollEditorIntoView: true,
  showPrintMargin: false
};

export const yamlDumpOptions = {
  noArrayIndent: true,
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

export interface ParsedSearch {
  name?: string;
  type?: string;
}

export interface IstioPermissions {
  [namespace: string]: {
    [type: string]: ResourcePermissions;
  };
}

export interface IstioPermissionsQuery {
  namespaces: string;
}

// Helper function to compare two IstioConfigDetails iterating over its IstioObject children.
// When an IstioObject child has changed (resourceVersion is different) it will return a tuple with
//  boolean: true if resourceVersion has changed in newer version
//  string: IstioObject child
//  string: resourceVersion of newer version
export const compareResourceVersion = (
  oldIstioConfigDetails: IstioConfigDetails,
  newIstioConfigDetails: IstioConfigDetails
): [boolean, string, string] => {
  const keys = Object.keys(oldIstioConfigDetails);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const oldIstioObject = oldIstioConfigDetails[key] as IstioObject;
    const newIstioObject = newIstioConfigDetails[key] as IstioObject;

    if (
      oldIstioObject &&
      newIstioObject &&
      oldIstioObject.metadata &&
      newIstioObject.metadata &&
      oldIstioObject.metadata.resourceVersion &&
      newIstioObject.metadata.resourceVersion &&
      oldIstioObject.metadata.resourceVersion !== newIstioObject.metadata.resourceVersion
    ) {
      return [true, key, newIstioObject.metadata.resourceVersion];
    }
  }

  return [false, '', ''];
};
