import { ObjectValidation, ValidationTypes } from '../IstioObjects';
import { parseKialiValidations } from '../EditorValidations';
import { dicTypeToGVK, gvkType } from '../IstioConfigList';

const fs = require('fs');

const destinationRuleValidations: ObjectValidation = {
  name: 'details',
  objectGVK: dicTypeToGVK[gvkType.DestinationRule],
  valid: false,
  checks: [
    {
      message: "Host doesn't have a valid service",
      severity: ValidationTypes.Error,
      path: 'spec/host'
    }
  ]
};

const vsInvalidHosts: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: "Hosts doesn't have a valid service",
      severity: ValidationTypes.Error,
      path: 'spec/hosts'
    }
  ]
};

const vsInvalidHttpFirstRoute: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'All routes should have weight',
      severity: ValidationTypes.Error,
      path: 'spec/http[0]/route'
    }
  ]
};

const vsInvalidHttpSecondRoute: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'All routes should have weight',
      severity: ValidationTypes.Error,
      path: 'spec/http[1]/route'
    }
  ]
};

const vsInvalidHttpThirdRoute: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'All routes should have weight',
      severity: ValidationTypes.Error,
      path: 'spec/http[2]/route'
    }
  ]
};

const vsInvalidHttpSecondSecondDestinationField: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Destination field is mandatory',
      severity: ValidationTypes.Error,
      path: 'spec/http[1]/route[1]'
    }
  ]
};

const vsInvalidHttpThirdFirstDestinationField: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Destination field is mandatory',
      severity: ValidationTypes.Error,
      path: 'spec/http[2]/route[0]'
    }
  ]
};

const vsInvalidHttpThirdFirstSubsetNotFound: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Subset not found',
      severity: ValidationTypes.Warning,
      path: 'spec/http[2]/route[0]/destination'
    }
  ]
};

const vsInvalidHttpFirstSecondSubsetNotFound: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Subset not found',
      severity: ValidationTypes.Warning,
      path: 'spec/http[0]/route[1]/destination'
    }
  ]
};

const vsInvalidHttpFourthFirstWeigth: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Weight must be a number',
      severity: ValidationTypes.Warning,
      path: 'spec/http[3]/route[0]/weigth/25a'
    }
  ]
};

const vsInvalidHttpFifthSecondWeigth: ObjectValidation = {
  name: 'productpage',
  objectGVK: dicTypeToGVK[gvkType.VirtualService],
  valid: false,
  checks: [
    {
      message: 'Weight must be a number',
      severity: ValidationTypes.Warning,
      path: 'spec/http[4]/route[1]/weigth/28a'
    }
  ]
};

const destinationRuleYaml = fs.readFileSync(`./src/types/__testData__/destinationRule.yaml`).toString();
const virtualServiceYaml = fs.readFileSync(`./src/types/__testData__/virtualService.yaml`).toString();

describe('#parseKialiValidations in DestinationRule', () => {
  it('should mark an invalid host', () => {
    const validations = parseKialiValidations(destinationRuleYaml, destinationRuleValidations);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    // Markers use 1-based line numbers (Monaco convention)
    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(4);
    expect(marker.endLineNumber).toEqual(4);
    expect(marker.startColumn).toEqual(1);

    // Annotations keep 0-based row for internal use
    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(0);
    expect(annotation.row).toEqual(3);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual("Host doesn't have a valid service");
  });
});

describe('#parseKialiValidations in VirtualService', () => {
  it('should detect invalid hosts', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHosts);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(4);
    expect(marker.endLineNumber).toEqual(5);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(0);
    expect(annotation.row).toEqual(3);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual("Hosts doesn't have a valid service");
  });

  it('should detect invalid first http route', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpFirstRoute);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toBe(13);
    expect(marker.endLineNumber).toBe(19);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toBe(4);
    expect(annotation.row).toBe(12);
    expect(annotation.type).toBe('error');
    expect(annotation.text).toBe('All routes should have weight');
  });

  it('should detect invalid second http route', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpSecondRoute);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(23);
    expect(marker.endLineNumber).toEqual(29);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(4);
    expect(annotation.row).toEqual(22);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual('All routes should have weight');
  });

  it('should detect invalid third http route', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpThirdRoute);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(33);
    expect(marker.endLineNumber).toEqual(39);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(4);
    expect(annotation.row).toEqual(32);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual('All routes should have weight');
  });

  it('should detect invalid second http second destination field', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpSecondSecondDestinationField);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(27);
    expect(marker.endLineNumber).toEqual(29);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(4);
    expect(annotation.row).toEqual(26);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual('Destination field is mandatory');
  });

  it('should detect invalid third http first destination field', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpThirdFirstDestinationField);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(34);
    expect(marker.endLineNumber).toEqual(36);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(6);
    expect(annotation.row).toEqual(33);
    expect(annotation.type).toEqual('error');
    expect(annotation.text).toEqual('Destination field is mandatory');
  });

  it('should detect invalid third http first destination field subset not found', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpThirdFirstSubsetNotFound);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(34);
    expect(marker.endLineNumber).toEqual(36);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(8);
    expect(annotation.row).toEqual(33);
    expect(annotation.type).toEqual('warning');
    expect(annotation.text).toEqual('Subset not found');
  });

  it('should detect invalid first http second destination field subset not found', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpFirstSecondSubsetNotFound);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(17);
    expect(marker.endLineNumber).toEqual(19);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(8);
    expect(annotation.row).toEqual(16);
    expect(annotation.type).toEqual('warning');
    expect(annotation.text).toEqual('Subset not found');
  });

  it('should detect invalid fourth http first weight', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpFourthFirstWeigth);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toBe(1);
    expect(validations.annotations.length).toBe(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(47);
    expect(marker.endLineNumber).toEqual(47);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(16);
    expect(annotation.row).toEqual(46);
    expect(annotation.type).toEqual('warning');
    expect(annotation.text).toEqual('Weight must be a number');
  });

  it('should detect invalid fifth http second weight', () => {
    const validations = parseKialiValidations(virtualServiceYaml, vsInvalidHttpFifthSecondWeigth);
    expect(validations).toBeDefined();
    expect(validations.markers.length).toEqual(1);
    expect(validations.annotations.length).toEqual(1);

    const marker = validations.markers[0];
    expect(marker).toBeDefined();
    expect(marker.startLineNumber).toEqual(63);
    expect(marker.endLineNumber).toEqual(63);

    const annotation = validations.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.column).toEqual(16);
    expect(annotation.row).toEqual(62);
    expect(annotation.type).toEqual('warning');
    expect(annotation.text).toEqual('Weight must be a number');
  });
});
