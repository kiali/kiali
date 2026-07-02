import type { HelpMessage, ObjectCheck, ObjectValidation } from './IstioObjects';
import type { editor } from 'monaco-editor';
import { MarkerSeverity } from 'monaco-editor';
import { YAMLException, loadAll } from 'js-yaml';
import type { Monaco } from '@monaco-editor/react';

export type MonacoInstance = Monaco;

export interface EditorMarker {
  endColumn: number;
  endLineNumber: number;
  message: string;
  severity: MarkerSeverity;
  startColumn: number;
  startLineNumber: number;
}

export interface EditorAnnotation {
  column: number;
  row: number;
  text: string;
  type: string;
}

export interface AceValidations {
  annotations: Array<EditorAnnotation>;
  markers: Array<EditorMarker>;
}

interface MarkerPosition {
  endCol: number;
  endRow: number;
  position: number;
  startCol: number;
  startRow: number;
}

interface YamlPosition {
  col: number;
  position: number;
  row: number;
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

export const rowColToPos = (yaml: string, row: number, col: number): number => {
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
      return col === 0 ? i + 1 : i;
    }
  }
  return pos;
};

export const parseLine = (yaml: string, row: number): string => {
  let i = 0;
  let j = 0;

  for (i; i < yaml.length; i++) {
    if (yaml.charAt(i) === '\n') {
      j = j + 1;
    }

    if (j === row) break;
  }

  return yaml.substring(i + 1, yaml.indexOf('\n', i + 1));
};

export const parseHelpAnnotations = (yaml: string, helpMessages: HelpMessage[]): EditorAnnotation[] => {
  const annotations: EditorAnnotation[] = [];
  const lastPosition = -1;

  helpMessages.forEach(hm => {
    const marker = parseMarker(
      yaml,
      lastPosition,
      hm.objectField.substring(hm.objectField.lastIndexOf('.') + 1),
      false
    );

    const annotation: EditorAnnotation = {
      row: marker.startRow,
      column: marker.startCol,
      type: 'info',
      text: 'This field has help information. Check the side panel for more information.'
    };

    if (marker.position !== -1) {
      annotations.push(annotation);
    }
  });

  return annotations;
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
): MarkerPosition => {
  const markerPos: MarkerPosition = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    position: -1
  };

  let tokenPos = startsFrom;

  if (startsFrom < 0) {
    const regex = /\b(?<!f:)spec:/g;
    const match = regex.exec(yaml.slice(tokenPos < 0 ? 0 : tokenPos));

    if (match) {
      tokenPos = match.index + tokenPos;
    } else {
      tokenPos = -1;
    }
  }

  tokenPos = yaml.indexOf(token, tokenPos);
  if (tokenPos < 0) {
    return markerPos;
  }

  const maxRows = numRows(yaml);

  if (isArray && arrayIndex !== undefined) {
    tokenPos = yaml.indexOf('-', tokenPos);
    const firstArrayRowCol = posToRowCol(yaml, tokenPos);
    let row = firstArrayRowCol.row;
    const col = firstArrayRowCol.col;
    let arrayIndexPos = tokenPos;
    let indexRow = 0;
    while (row < maxRows && indexRow < arrayIndex) {
      row++;
      const checkPos = rowColToPos(yaml, row, col);
      if (yaml.charAt(checkPos) === '-') {
        arrayIndexPos = checkPos;
        indexRow++;
      }
    }
    const arrayRowCol = posToRowCol(yaml, arrayIndexPos);
    markerPos.position = arrayIndexPos + 1;
    markerPos.startRow = arrayRowCol.row;
    markerPos.startCol = arrayRowCol.col;
  } else {
    const tokenRowCol = posToRowCol(yaml, tokenPos);
    markerPos.position = tokenPos + token.length;
    markerPos.startRow = tokenRowCol.row;
    markerPos.startCol = tokenRowCol.col;
  }

  for (let row = markerPos.startRow + 1; row < maxRows + 1; row++) {
    for (let col = 0; col <= markerPos.startCol; col++) {
      const endTokenPos = rowColToPos(yaml, row, col);
      if (yaml.charAt(endTokenPos) !== ' ' && (isArray || yaml.charAt(endTokenPos) !== '-')) {
        markerPos.endRow = row;
        markerPos.endCol = 0;
        return markerPos;
      }
    }
  }
  return markerPos;
};

const getSeverity = (severity: string): MarkerSeverity => {
  switch (severity) {
    case 'error':
      return MarkerSeverity.Error;
    case 'warning':
      return MarkerSeverity.Warning;
    case 'info':
    default:
      return MarkerSeverity.Info;
  }
};

interface ParsedCheck {
  annotation: EditorAnnotation;
  marker: EditorMarker;
}

const parseCheck = (yaml: string, check: ObjectCheck): ParsedCheck => {
  const severity = check.severity === 'error' || check.severity === 'warning' ? check.severity : 'info';
  const message = (check.code ? `${check.code} ` : '') + check.message;

  let markerPos: MarkerPosition = {
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    position: -1
  };

  if (check.path.length > 0) {
    const tokens: string[] = check.path.split('/');
    if (tokens.length > 1) {
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.indexOf('[') > -1 && token.indexOf(']') > -1) {
          const startPos = token.indexOf('[');
          const endPos = token.indexOf(']');
          const arrayIndex = +token.substr(startPos + 1, endPos - startPos - 1);
          const subtoken = token.substr(0, startPos);
          markerPos = parseMarker(yaml, markerPos.position, subtoken, true, arrayIndex);
        } else {
          markerPos = parseMarker(yaml, markerPos.position, token, false);
        }
      }
    }
  }

  const endRow = markerPos.endRow > 0 ? markerPos.endRow - 1 : 0;

  const marker: EditorMarker = {
    startLineNumber: markerPos.startRow + 1,
    startColumn: 1,
    endLineNumber: endRow + 1,
    endColumn: 1,
    severity: getSeverity(severity),
    message
  };

  const annotation: EditorAnnotation = {
    row: markerPos.startRow,
    column: markerPos.startCol,
    type: severity,
    text: message
  };

  return { marker, annotation };
};

export const parseKialiValidations = (yamlInput: string, kialiValidations?: ObjectValidation): AceValidations => {
  const validations: AceValidations = {
    markers: [],
    annotations: []
  };

  if (!kialiValidations || yamlInput.length === 0 || Object.keys(kialiValidations).length === 0) {
    return validations;
  }

  kialiValidations.checks.forEach(check => {
    const parsed = parseCheck(yamlInput, check);
    validations.markers.push(parsed.marker);
    validations.annotations.push(parsed.annotation);
  });
  return validations;
};

export const parseYamlValidations = (yamlInput: string): AceValidations => {
  const parsedValidations: AceValidations = {
    markers: [],
    annotations: []
  };
  try {
    loadAll(yamlInput);
  } catch (e) {
    if (e instanceof YAMLException) {
      const row = e.mark && e.mark.line ? e.mark.line : 0;
      const col = e.mark && e.mark.column ? e.mark.column : 0;
      const message = e.message ? e.message : '';
      parsedValidations.markers.push({
        startLineNumber: row + 1,
        startColumn: 1,
        endLineNumber: row + 2,
        endColumn: 1,
        severity: MarkerSeverity.Error,
        message
      });
      parsedValidations.annotations.push({
        row: row,
        column: col,
        type: 'error',
        text: message
      });
    }
  }
  return parsedValidations;
};

const editorDecorationsMap = new WeakMap<editor.IStandaloneCodeEditor, editor.IEditorDecorationsCollection>();

/**
 * Apply validation markers and glyph margin decorations to a Monaco editor.
 * Markers produce squiggly underlines; decorations show icons in the glyph margin.
 */
export const applyMonacoMarkers = (
  monacoInstance: MonacoInstance,
  editorInstance: editor.IStandaloneCodeEditor,
  markers: EditorMarker[]
): void => {
  const model = editorInstance.getModel();
  if (!model) {
    return;
  }
  monacoInstance.editor.setModelMarkers(model, 'kiali', markers);

  const existingCollection = editorDecorationsMap.get(editorInstance);
  if (existingCollection) {
    existingCollection.clear();
  }

  const decorations: editor.IModelDeltaDecoration[] = markers.map(m => {
    let glyphClass = 'kiali-glyph-info';
    if (m.severity === MarkerSeverity.Error) {
      glyphClass = 'kiali-glyph-error';
    } else if (m.severity === MarkerSeverity.Warning) {
      glyphClass = 'kiali-glyph-warning';
    }
    return {
      range: new monacoInstance.Range(m.startLineNumber, 1, m.startLineNumber, 1),
      options: {
        glyphMarginClassName: glyphClass,
        glyphMarginHoverMessage: { value: m.message }
      }
    };
  });

  const collection = editorInstance.createDecorationsCollection(decorations);
  editorDecorationsMap.set(editorInstance, collection);
};
