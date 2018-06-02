import { Annotation, Marker } from 'react-ace';
import { ObjectCheck, ObjectValidation, Validations } from './ServiceInfo';

export interface AceValidations {
  markers: Array<Marker>;
  annotations: Array<Annotation>;
}

interface AceCheck {
  marker: Marker;
  annotation: Annotation;
}

interface AceMarker {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const getObjectValidations = (validations: Validations): ObjectValidation[] => {
  let oValidations: ObjectValidation[] = [];
  Object.keys(validations).forEach(objectType => {
    Object.keys(validations[objectType]).forEach(object => oValidations.push(validations[objectType][object]));
  });
  return oValidations;
};

const parseMarker = (yaml: string, word: string, occurrence?: number): AceMarker => {
  let aceMarker: AceMarker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0
  };
  let startPos = -1;
  if (occurrence) {
    let fromPos = 0;
    for (let i = 0; i < occurrence; i++) {
      startPos = yaml.indexOf(word, fromPos);
    }
  } else {
    startPos = yaml.indexOf(word);
  }
  if (startPos < 0) {
    return aceMarker;
  }

  let lastNL = -1;
  for (let i = 0; i < startPos; i++) {
    if (yaml.charAt(i) === '\n') {
      aceMarker.startRow++;
      lastNL = i;
    }
  }
  aceMarker.startCol = lastNL > -1 ? startPos - (lastNL + 1) : startPos;
  aceMarker.endCol = 0;
  aceMarker.endRow = aceMarker.startRow + 1;

  let nextNL = -1;
  for (let i = lastNL > -1 ? lastNL + 1 : 0; i < yaml.length; i++) {
    if (yaml.charAt(i) === '\n') {
      nextNL = i;
      let checkCol = 0;
      let checkBlank = nextNL;
      do {
        checkBlank++;
      } while (yaml.charAt(checkBlank) === ' ');
      checkCol = checkBlank - (nextNL + 1);
      if (aceMarker.startCol >= checkCol) {
        break;
      }
      aceMarker.endRow++;
    }
  }
  return aceMarker;
};

const parseCheck = (yaml: string, check: ObjectCheck): AceCheck => {
  let severity = check.severity === 'error' || check.severity === 'warning' ? check.severity : 'error';
  let marker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    className: 'istio-validation-' + severity,
    type: severity
  };
  let annotation = {
    row: 0,
    column: 10,
    type: severity,
    text: check.message
  };
  let aceMarker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0
  };
  /*
    Potential paths:
      - <empty, no path>
      - spec/destination
      - spec/name (this is used for destination Rules which maps spec/name into destinationName)
      - spec/precedence/<value>
      - spec/route/weight/<value>
      - spec/route[<value>]/labels
      - spec/hosts

    For this version we are going to mark the first element block.
    In future iterations we can add more granularity and try to mark just the offending word.
   */
  if (check.path.length > 0) {
    let path = check.path;
    if (path.startsWith('spec/destination')) {
      aceMarker = parseMarker(yaml, 'destination:');
    } else if (path.startsWith('spec/name')) {
      // This usecase comes from Destination Rule, the spec/name in the original yaml object is brought into kiali as destinationName field
      aceMarker = parseMarker(yaml, 'destinationName:');
    } else if (path.startsWith('spec/precedence')) {
      aceMarker = parseMarker(yaml, 'precedence:');
    } else if (path.startsWith('spec/route/weight')) {
      aceMarker = parseMarker(yaml, 'route:');
    } else if (path.startsWith('spec/route[')) {
      let startPos = path.indexOf('[');
      let endPos = path.indexOf(']');
      let labelPos = path.substr(startPos + 1, endPos - startPos - 1);
      aceMarker = parseMarker(yaml, 'labels:', +labelPos);
    } else if (path.startsWith('spec/hosts')) {
      aceMarker = parseMarker(yaml, 'hosts:');
    }
  }

  marker.startRow = aceMarker.startRow;
  marker.startCol = aceMarker.startCol;
  marker.endRow = aceMarker.endRow;
  marker.endCol = aceMarker.endCol;
  annotation.row = marker.startRow;
  annotation.column = marker.startCol;

  return { marker: marker, annotation: annotation };
};

export const parseAceValidations = (yaml: string, validations?: Validations): AceValidations => {
  let aceValidations: AceValidations = {
    markers: [],
    annotations: []
  };

  if (!validations || yaml.length === 0 || Object.keys(validations).length === 0) {
    return aceValidations;
  }

  let objectValidations = getObjectValidations(validations);
  objectValidations.forEach(objectValidation => {
    if (!objectValidation.valid && objectValidation.checks) {
      objectValidation.checks.forEach(check => {
        let aceCheck = parseCheck(yaml, check);
        aceValidations.markers.push(aceCheck.marker);
        aceValidations.annotations.push(aceCheck.annotation);
      });
    }
  });
  return aceValidations;
};
