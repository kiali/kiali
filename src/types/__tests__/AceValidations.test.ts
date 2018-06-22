import { Validations } from '../ServiceInfo';
import { parseAceValidations } from '../AceValidations';

const fs = require('fs');

export const mockPromiseFromFile = (path: string) => {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const destinationPolicyValidations: Validations = {
  destinationpolicy: {
    'reviews-cb': {
      name: 'reviews-cb',
      objectType: 'destinationpolicy',
      valid: false,
      checks: [
        {
          message: 'Destination doesnt have a valid service',
          severity: 'error',
          path: 'spec/destination'
        }
      ]
    }
  }
};

const destinationRuleValidations: Validations = {
  destinationrule: {
    details: {
      name: 'details',
      objectType: 'destinationrule',
      valid: false,
      checks: [
        {
          message: 'Host doesnt have a valid service',
          severity: 'error',
          path: 'spec/host'
        }
      ]
    }
  }
};

const routeRuleValidations: Validations = {
  routerule: {
    'recommendation-503': {
      name: 'recommendation-503',
      objectType: 'routerule',
      valid: false,
      checks: [
        {
          message: 'Destination doesnt have a valid service',
          severity: 'error',
          path: 'spec/destination'
        },
        {
          message: 'Precedence should be greater than or equal to 0',
          severity: 'error',
          path: 'spec/precedence/-1'
        },
        {
          message: 'Weight must be a number',
          severity: 'error',
          path: 'spec/route[0]/weight/25a'
        },
        {
          message: 'Weight sum should be 100',
          severity: 'error',
          path: ''
        },
        {
          message: 'No pods found for this selector',
          severity: 'warning',
          path: 'spec/route[0]/labels'
        }
      ]
    }
  }
};

const routeRule2Validations: Validations = {
  routerule: {
    'details-v2': {
      name: 'details-v2',
      objectType: 'routerule',
      valid: false,
      checks: [
        {
          message: 'Weight should be between 0 and 100',
          severity: 'error',
          path: 'spec/route[1]/weight/-50'
        },
        {
          message: 'Weight sum should be 100',
          severity: 'error',
          path: ''
        },
        {
          message: 'No pods found for this selector',
          severity: 'warning',
          path: 'spec/route[1]/labels'
        }
      ]
    }
  }
};

const virtualServicesValidations: Validations = {
  virtualservice: {
    productpage: {
      name: 'productpage',
      objectType: 'virtualservice',
      valid: false,
      checks: [
        {
          message: 'Hosts doesnt have a valid service',
          severity: 'error',
          path: 'spec/hosts'
        }
      ]
    }
  }
};

describe('#parseAceValidations in DestinationPolicy', () => {
  it('should detect AceValidations', () => {
    mockPromiseFromFile(`./src/types/__testData__/destinationPolicy.yaml`).then(destinationPolicyYaml => {
      const aceValidations = parseAceValidations(destinationPolicyYaml, destinationPolicyValidations);
      expect(aceValidations).toBeDefined();
      expect(aceValidations.markers.length).toBe(1);
      expect(aceValidations.annotations.length).toBe(1);

      /*
        Check it marks the lines 5-9:
          destination:
            labels:
              version: v2
            name: reviews
       */
      let marker = aceValidations.markers[0];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(4);
      expect(marker.endRow).toBe(8);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      let annotation = aceValidations.annotations[0];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(4);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Destination doesnt have a valid service');
    });
  });
});

describe('#parseAceValidations in DestinationRule', () => {
  it('should detect AceValidations', () => {
    mockPromiseFromFile(`./src/types/__testData__/destinationRule.yaml`).then(destinationRuleYaml => {
      const aceValidations = parseAceValidations(destinationRuleYaml, destinationRuleValidations);
      expect(aceValidations).toBeDefined();
      expect(aceValidations.markers.length).toBe(1);
      expect(aceValidations.annotations.length).toBe(1);

      /*
        Check it marks lines 4-5:
          destinationName: details
       */
      let marker = aceValidations.markers[0];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(3);
      expect(marker.endRow).toBe(4);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      let annotation = aceValidations.annotations[0];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(3);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Host doesnt have a valid service');
    });
  });
});

describe('#parseAceValidations in RouteRule', () => {
  it('should detect AceValidations', () => {
    mockPromiseFromFile(`./src/types/__testData__/routeRule.yaml`).then(routeRuleYaml => {
      const aceValidations = parseAceValidations(routeRuleYaml, routeRuleValidations);
      expect(aceValidations).toBeDefined();
      expect(aceValidations.markers.length).toBe(5);
      expect(aceValidations.annotations.length).toBe(5);

      /*
        Check it marks lines 4-7:
          destination:
            name: recommendation
            namespace: tutorial
       */
      let marker = aceValidations.markers[0];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(3);
      expect(marker.endRow).toBe(6);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      let annotation = aceValidations.annotations[0];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(3);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Destination doesnt have a valid service');

      /*
        Check it marks lines 7-8:
          precedence: 2
       */
      marker = aceValidations.markers[1];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(6);
      expect(marker.endRow).toBe(7);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[1];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(6);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Precedence should be greater than or equal to 0');

      /*
        Check it marks lines 12-13:
          weight: 25a
       */
      marker = aceValidations.markers[2];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(11);
      expect(marker.endRow).toBe(12);
      expect(marker.startCol).toBe(4);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[2];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(4);
      expect(annotation.row).toBe(11);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Weight must be a number');

      /*
        Check mark is set at beginning of the file
       */
      marker = aceValidations.markers[3];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(0);
      expect(marker.endRow).toBe(0);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[3];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(0);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Weight sum should be 100');

      /*
        Check it marks lines 10-12:
          - labels:
              version: 1
       */
      marker = aceValidations.markers[4];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(9);
      expect(marker.endRow).toBe(11);
      expect(marker.startCol).toBe(4);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[4];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(4);
      expect(annotation.row).toBe(9);
      expect(annotation.type).toBe('warning');
      expect(annotation.text).toBe('No pods found for this selector');
    });
  });
});

describe('#parseAceValidations in RouteRule2', () => {
  it('should detect AceValidations', () => {
    mockPromiseFromFile(`./src/types/__testData__/routeRule2.yaml`).then(routeRuleYaml => {
      const aceValidations = parseAceValidations(routeRuleYaml, routeRule2Validations);
      expect(aceValidations).toBeDefined();
      expect(aceValidations.markers.length).toBe(3);
      expect(aceValidations.annotations.length).toBe(3);

      /*
        Check it marks lines 14-15:
          weight: -50
       */
      let marker = aceValidations.markers[0];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(13);
      expect(marker.endRow).toBe(14);
      expect(marker.startCol).toBe(4);
      expect(marker.endCol).toBe(0);

      let annotation = aceValidations.annotations[0];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(4);
      expect(annotation.row).toBe(13);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Weight should be between 0 and 100');

      /*
        Check mark is set at beginning of the file
       */
      marker = aceValidations.markers[1];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(0);
      expect(marker.endRow).toBe(0);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[1];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(0);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Weight sum should be 100');

      /*
        Check it marks lines 12-14:
          - labels:
              version: v2
       */
      marker = aceValidations.markers[2];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(11);
      expect(marker.endRow).toBe(13);
      expect(marker.startCol).toBe(4);
      expect(marker.endCol).toBe(0);

      annotation = aceValidations.annotations[2];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(4);
      expect(annotation.row).toBe(11);
      expect(annotation.type).toBe('warning');
      expect(annotation.text).toBe('No pods found for this selector');
    });
  });
});

describe('#parseAceValidations in VirtualService', () => {
  it('should detect AceValidations', () => {
    mockPromiseFromFile(`./src/types/__testData__/virtualService.yaml`).then(virtualServiceYaml => {
      const aceValidations = parseAceValidations(virtualServiceYaml, virtualServicesValidations);
      expect(aceValidations).toBeDefined();
      expect(aceValidations.markers.length).toBe(1);
      expect(aceValidations.annotations.length).toBe(1);
      /*
        Check it marks lines 4-6:
          hosts:
            - productpage
       */
      let marker = aceValidations.markers[0];
      expect(marker).toBeDefined();
      expect(marker.startRow).toBe(3);
      expect(marker.endRow).toBe(5);
      expect(marker.startCol).toBe(0);
      expect(marker.endCol).toBe(0);

      let annotation = aceValidations.annotations[0];
      expect(annotation).toBeDefined();
      expect(annotation.column).toBe(0);
      expect(annotation.row).toBe(3);
      expect(annotation.type).toBe('error');
      expect(annotation.text).toBe('Hosts doesnt have a valid service');
    });
  });
});
