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
  position: number;
}

interface YamlPosition {
  position: number;
  row: number;
  col: number;
}

const getObjectValidations = (validations: Validations): ObjectValidation[] => {
  let oValidations: ObjectValidation[] = [];
  Object.keys(validations).forEach(objectType => {
    Object.keys(validations[objectType]).forEach(object => oValidations.push(validations[objectType][object]));
  });
  return oValidations;
};

const numRows = (yaml: string): number => {
  let rows = 0;
  for (let i = 0; i < yaml.length; i++) {
    if (yaml.charAt(i) === '\n') {
      rows++;
    }
  }
  return rows;
};

const posToRowCol = (yaml: string, pos: number): YamlPosition => {
  let rowCol: YamlPosition = {
    position: pos,
    row: 0,
    col: 0
  };
  let lastNL = -1;
  for (let i = 0; i < pos; i++) {
    if (yaml.charAt(i) === '\n') {
      rowCol.row++;
      lastNL = i;
    }
  }
  rowCol.col = lastNL > -1 ? pos - (lastNL + 1) : pos;
  return rowCol;
};

const rowColToPos = (yaml: string, row: number, col: number): number => {
  let currentRow = 0;
  let currentCol = 0;
  let pos = -1;
  for (let i = 0; i < yaml.length; i++) {
    if (yaml.charAt(i) === '\n') {
      currentRow++;
      currentCol = -1;
    } else {
      currentCol++;
    }
    if (currentRow === row && currentCol === col) {
      // If col == 0, pos is NL char, so returned pos should be first char after NL
      return col === 0 ? i + 1 : i;
    }
  }
  return pos;
};

/*
  Find a token inside a yaml based string.
  Returns the row/col coordinates of the token.
  It manages special cases where a token is an array.
 */
const parseMarker = (
  yaml: string,
  startsFrom: number,
  token: string,
  isArray: boolean,
  arrayIndex?: number
): AceMarker => {
  let aceMarker: AceMarker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    position: -1
  };

  // Find initial token position
  let tokenPos = yaml.indexOf(token, startsFrom);
  if (tokenPos < 0) {
    return aceMarker;
  }

  let maxRows = numRows(yaml);

  // Array should find first '-' token to situate pos
  if (isArray && arrayIndex !== undefined) {
    tokenPos = yaml.indexOf('-', tokenPos);
    // We should find the right '-' under the same col of the yaml
    let firstArrayRowCol = posToRowCol(yaml, tokenPos);
    let row = firstArrayRowCol.row;
    let col = firstArrayRowCol.col;
    let arrayIndexPos = tokenPos;
    let indexRow = 0;
    // Iterate to find next '-' token according arrayIndex
    while (row < maxRows && indexRow < arrayIndex) {
      row++;
      let checkPos = rowColToPos(yaml, row, col);
      if (yaml.charAt(checkPos) === '-') {
        arrayIndexPos = checkPos;
        indexRow++;
      }
    }
    let arrayRowCol = posToRowCol(yaml, arrayIndexPos);
    aceMarker.position = arrayIndexPos + 1; // Increase the index to not repeat same finding on next iteration
    aceMarker.startRow = arrayRowCol.row;
    aceMarker.startCol = arrayRowCol.col;
  } else {
    let tokenRowCol = posToRowCol(yaml, tokenPos);
    aceMarker.position = tokenPos + token.length; // Increase the index to not repeat same finding on next iteration
    aceMarker.startRow = tokenRowCol.row;
    aceMarker.startCol = tokenRowCol.col;
  }

  // Once start is calculated, we should calculate the end of the element iterating by rows
  for (let row = aceMarker.startRow + 1; row < maxRows; row++) {
    // It searches by row and column, starting from the beginning of the line
    for (let col = 0; col <= aceMarker.startCol; col++) {
      let endTokenPos = rowColToPos(yaml, row, col);
      // We need to differentiate if token is an array or not to mark the end of the mark
      if (yaml.charAt(endTokenPos) !== ' ' && (isArray || yaml.charAt(endTokenPos) !== '-')) {
        aceMarker.endRow = row;
        aceMarker.endCol = 0;
        return aceMarker;
      }
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
    column: 0,
    type: severity,
    text: check.message
  };
  let aceMarker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    position: -1
  };
  /*
    Potential paths:
      - <empty, no path>
      - spec/hosts
      - spec/host
      - spec/<protocol: http|tcp>[<nRoute>]/route
      - spec/<protocol: http|tcp>[<nRoute>]/route[nDestination]
      - spec/<protocol: http|tcp>[<nRoute>]/route[<nDestination>]/weight/<value>
      - spec/<protocol: http|tcp>[nRoute]/route[nDestination]/destination
   */
  if (check.path.length > 0) {
    let tokens: string[] = check.path.split('/');
    // It skips the first 'spec' token
    if (tokens.length > 1) {
      for (let i = 1; i < tokens.length; i++) {
        let token = tokens[i];
        // Check if token has an array or not
        if (token.indexOf('[') > -1 && token.indexOf(']') > -1) {
          let startPos = token.indexOf('[');
          let endPos = token.indexOf(']');
          let arrayIndex = +token.substr(startPos + 1, endPos - startPos - 1);
          let subtoken = token.substr(0, startPos);
          aceMarker = parseMarker(yaml, aceMarker.position, subtoken, true, arrayIndex);
        } else {
          aceMarker = parseMarker(yaml, aceMarker.position, token, false);
        }
      }
    }
  }

  marker.startRow = aceMarker.startRow;
  marker.startCol = aceMarker.startCol;
  marker.endRow = aceMarker.endRow;
  marker.endCol = aceMarker.endCol;
  annotation.row = marker.startRow;

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
    objectValidation.checks.forEach(check => {
      let aceCheck = parseCheck(yaml, check);
      aceValidations.markers.push(aceCheck.marker);
      aceValidations.annotations.push(aceCheck.annotation);
    });
  });
  return aceValidations;
};
