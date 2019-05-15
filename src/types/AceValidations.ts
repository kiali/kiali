import { Annotation, Marker } from 'react-ace';
import { ObjectCheck, ObjectValidation } from './IstioObjects';

export const jsYaml = require('js-yaml');

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
  const rowCol: YamlPosition = {
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
  const pos = -1;
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
  const aceMarker: AceMarker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    position: -1
  };

  let tokenPos = startsFrom;

  // Find start of the spec part first, this should skip the whole metadata part
  if (startsFrom < 0) {
    tokenPos = yaml.indexOf('spec:', tokenPos);
  }

  // Find initial token position
  tokenPos = yaml.indexOf(token, tokenPos);
  if (tokenPos < 0) {
    return aceMarker;
  }

  const maxRows = numRows(yaml);

  // Array should find first '-' token to situate pos
  if (isArray && arrayIndex !== undefined) {
    tokenPos = yaml.indexOf('-', tokenPos);
    // We should find the right '-' under the same col of the yaml
    const firstArrayRowCol = posToRowCol(yaml, tokenPos);
    let row = firstArrayRowCol.row;
    const col = firstArrayRowCol.col;
    let arrayIndexPos = tokenPos;
    let indexRow = 0;
    // Iterate to find next '-' token according arrayIndex
    while (row < maxRows && indexRow < arrayIndex) {
      row++;
      const checkPos = rowColToPos(yaml, row, col);
      if (yaml.charAt(checkPos) === '-') {
        arrayIndexPos = checkPos;
        indexRow++;
      }
    }
    const arrayRowCol = posToRowCol(yaml, arrayIndexPos);
    aceMarker.position = arrayIndexPos + 1; // Increase the index to not repeat same finding on next iteration
    aceMarker.startRow = arrayRowCol.row;
    aceMarker.startCol = arrayRowCol.col;
  } else {
    const tokenRowCol = posToRowCol(yaml, tokenPos);
    aceMarker.position = tokenPos + token.length; // Increase the index to not repeat same finding on next iteration
    aceMarker.startRow = tokenRowCol.row;
    aceMarker.startCol = tokenRowCol.col;
  }

  // Once start is calculated, we should calculate the end of the element iterating by rows
  for (let row = aceMarker.startRow + 1; row < maxRows + 1; row++) {
    // It searches by row and column, starting from the beginning of the line
    for (let col = 0; col <= aceMarker.startCol; col++) {
      const endTokenPos = rowColToPos(yaml, row, col);
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
  const severity = check.severity === 'error' || check.severity === 'warning' ? check.severity : 'info';
  const marker = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    className: 'istio-validation-' + severity,
    type: severity
  };
  const annotation = {
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
    const tokens: string[] = check.path.split('/');
    // It skips the first 'spec' token
    if (tokens.length > 1) {
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        // Check if token has an array or not
        if (token.indexOf('[') > -1 && token.indexOf(']') > -1) {
          const startPos = token.indexOf('[');
          const endPos = token.indexOf(']');
          const arrayIndex = +token.substr(startPos + 1, endPos - startPos - 1);
          const subtoken = token.substr(0, startPos);
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

export const parseKialiValidations = (yamlInput: string, kialiValidations?: ObjectValidation): AceValidations => {
  const aceValidations: AceValidations = {
    markers: [],
    annotations: []
  };

  if (!kialiValidations || yamlInput.length === 0 || Object.keys(kialiValidations).length === 0) {
    return aceValidations;
  }

  kialiValidations.checks.forEach(check => {
    const aceCheck = parseCheck(yamlInput, check);
    aceValidations.markers.push(aceCheck.marker);
    aceValidations.annotations.push(aceCheck.annotation);
  });
  return aceValidations;
};

export const parseYamlValidations = (yamlInput: string): AceValidations => {
  const parsedValidations: AceValidations = {
    markers: [],
    annotations: []
  };
  try {
    jsYaml.safeLoadAll(yamlInput);
  } catch (e) {
    const row = e.mark && e.mark.line ? e.mark.line : 0;
    const col = e.mark && e.mark.column ? e.mark.column : 0;
    const message = e.message ? e.message : '';
    parsedValidations.markers.push({
      startRow: row,
      startCol: 0,
      endRow: row + 1,
      endCol: 0,
      className: 'istio-validation-error',
      type: 'error'
    });
    parsedValidations.annotations.push({
      row: row,
      column: col,
      type: 'error',
      text: message
    });
  }
  return parsedValidations;
};
