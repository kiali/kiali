// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import calcPositioning, { _initSvcSpan, _initOpSpan } from './calc-positioning';
import { FONT_SIZE, LINE_HEIGHT, OP_PADDING_TOP } from './constants';

describe('initializing measuring spans', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  it('makes spans iff they do not exist', () => {
    expect(document.getElementsByTagName('span')).toHaveLength(0);

    const svcSpan0 = _initSvcSpan();
    expect(document.getElementsByTagName('span')).toHaveLength(1);
    const opSpan0 = _initOpSpan();
    expect(document.getElementsByTagName('span')).toHaveLength(2);

    const svcSpan1 = _initSvcSpan();
    const opSpan1 = _initOpSpan();
    expect(document.getElementsByTagName('span')).toHaveLength(2);
    expect(svcSpan1).toBe(svcSpan0);
    expect(opSpan1).toBe(opSpan0);
  });
});

describe('calcPositioning', () => {
  let svcMeasurements;
  let opMeasurements;
  let genStrCalls = 0;
  const genStr = n => `${new Array(n).fill('foo').join(':')}${genStrCalls++}`;
  const lineHeight = LINE_HEIGHT * FONT_SIZE;
  const measureSvc = jest.fn().mockImplementation(() => [svcMeasurements[measureSvc.mock.calls.length - 1]]);
  const measureOp = jest.fn().mockImplementation(() => [opMeasurements[measureOp.mock.calls.length - 1]]);
  const genWidths = mods => mods.map(mod => ({ width: lineHeight * mod }));
  const calcPos = () =>
    calcPositioning(genStr(svcMeasurements.length), opMeasurements && genStr(opMeasurements.length));

  beforeAll(() => {
    const svcSpan = _initSvcSpan();
    const opSpan = _initOpSpan();
    svcSpan.getClientRects = measureSvc;
    opSpan.getClientRects = measureOp;
  });

  beforeEach(() => {
    svcMeasurements = undefined;
    opMeasurements = undefined;
    measureSvc.mockClear();
    measureOp.mockClear();
  });

  afterAll(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  describe('service only', () => {
    it('returns radius of one word', () => {
      svcMeasurements = genWidths([2.5]);
      const { width } = svcMeasurements[0];
      const { radius, svcWidth, svcMarginTop } = calcPos();
      expect(svcWidth).toBe(width);
      expect(radius).toBeCloseTo(Math.sqrt(width ** 2 + lineHeight ** 2) / 2, 8);
      expect(svcMarginTop).toBe(radius - lineHeight / 2);
    });

    it('returns radius of two words on same line', () => {
      svcMeasurements = genWidths([0.5, 0.5]);
      const { radius, svcWidth, svcMarginTop } = calcPos();
      expect(svcWidth).toBe(lineHeight);
      expect(radius).toBeCloseTo((Math.sqrt(2) * lineHeight) / 2, 8);
      expect(svcMarginTop).toBe(radius - lineHeight / 2);
    });

    it('returns radius of two words on different lines', () => {
      svcMeasurements = genWidths([2, 2]);
      const { radius, svcWidth, svcMarginTop } = calcPos();
      expect(svcWidth).toBe(lineHeight * 2);
      expect(radius).toBeCloseTo(Math.sqrt(2) * lineHeight, 8);
      expect(svcMarginTop).toBe(radius - lineHeight);
    });

    it('returns radius of three words on two lines', () => {
      svcMeasurements = genWidths([1, 1, 2]);
      const { radius, svcWidth, svcMarginTop } = calcPos();
      expect(svcWidth).toBe(lineHeight * 2);
      expect(radius).toBeCloseTo(Math.sqrt(2) * lineHeight, 8);
      expect(svcMarginTop).toBe(radius - lineHeight);
    });

    it('returns radius of many words on many lines', () => {
      svcMeasurements = genWidths([1.5, 1.3, 2, 0.05, 1.4, 0.7]);
      const { radius, svcWidth, svcMarginTop } = calcPos();
      expect(svcWidth).toBe(lineHeight * 2.8);
      expect(radius).toBeCloseTo(Math.sqrt((1.5 * lineHeight) ** 2 + (svcWidth / 2) ** 2), 8);
      expect(svcMarginTop).toBe(radius - lineHeight * 1.5);
    });
  });

  describe('service and operation', () => {
    describe('both service and operation influence radius', () => {
      it('returns radius of single word service and operation', () => {
        svcMeasurements = genWidths([1]);
        opMeasurements = genWidths([1]);
        const { opWidth, radius, svcWidth, svcMarginTop } = calcPos();
        expect(svcWidth).toBe(lineHeight);
        expect(opWidth).toBe(lineHeight);
        expect(radius).toBeCloseTo(
          Math.sqrt((lineHeight + 0.5 * OP_PADDING_TOP) ** 2 + (lineHeight / 2) ** 2),
          8
        );
        expect(svcMarginTop).toBe(radius - lineHeight - OP_PADDING_TOP / 2);
      });

      it('keeps svc and op rects wider for lower resulting radius', () => {
        svcMeasurements = genWidths([2, 2, 2]);
        opMeasurements = svcMeasurements;
        const { svcWidth: opWidthWithoutSvc } = calcPositioning(genStr(svcMeasurements.length));
        measureSvc.mockClear();

        svcMeasurements = genWidths([1.5, 1.5, 1.5]);
        const { svcWidth: svcWidthWithoutOp } = calcPositioning(genStr(svcMeasurements.length));
        measureSvc.mockClear();

        const { opWidth, radius, svcWidth, svcMarginTop } = calcPos();
        expect(svcWidth).toBeGreaterThan(svcWidthWithoutOp);
        expect(opWidth).toBeGreaterThan(opWidthWithoutSvc);
        expect(radius).toMatchInlineSnapshot(`56.268565187168726`);
        expect(svcMarginTop).toBe(radius - radius * Math.sin(Math.acos(svcWidth / 2 / radius)));
      });

      it('it handles strings without words', () => {
        svcMeasurements = genWidths([3]);
        opMeasurements = genWidths([3]);
        const { opWidth, radius, svcWidth, svcMarginTop } = calcPositioning('::::', '/////');
        expect(svcWidth).toBe(3 * lineHeight);
        expect(opWidth).toBe(3 * lineHeight);
        expect(radius).toBeCloseTo(
          Math.sqrt((lineHeight + 0.5 * OP_PADDING_TOP) ** 2 + (1.5 * lineHeight) ** 2),
          8
        );
        expect(svcMarginTop).toBe(radius - lineHeight - OP_PADDING_TOP / 2);
      });
    });

    describe('neglible service rectangle', () => {
      it('returns radius of operations', () => {
        svcMeasurements = genWidths([1]);
        opMeasurements = genWidths([10, 10, 10]);
        const { opWidth, radius, svcWidth, svcMarginTop } = calcPos();
        expect(svcWidth).toBe(lineHeight);
        expect(opWidth).toBe(lineHeight * 10);
        expect(radius).toBeCloseTo(Math.sqrt((1.5 * lineHeight) ** 2 + (opWidth / 2) ** 2), 8);
        expect(svcMarginTop).toBe(radius - lineHeight * 2.5 - OP_PADDING_TOP);
      });
    });

    describe('neglible operation rectangle', () => {
      it('returns radius of services', () => {
        svcMeasurements = genWidths([10, 10, 10]);
        opMeasurements = genWidths([1]);
        const { opWidth, radius, svcWidth, svcMarginTop } = calcPos();
        expect(svcWidth).toBe(lineHeight * 10);
        expect(opWidth).toBe(lineHeight);
        expect(radius).toBeCloseTo(Math.sqrt((1.5 * lineHeight) ** 2 + (svcWidth / 2) ** 2), 8);
        expect(svcMarginTop).toBe(radius - lineHeight * 1.5);
      });
    });
  });

  describe('memoization', () => {
    it('returns the same result for same service and operation', () => {
      svcMeasurements = genWidths([1, 2, 3, 4, 5]);
      opMeasurements = genWidths([5, 4, 3, 2, 1]);
      const service = 'testService';
      const operation = 'testOperation';
      const diffService = 'diffService';
      const diffOperation = 'diffOperation';
      const firstResult = calcPositioning(service, operation);

      expect(calcPositioning(service, operation)).toBe(firstResult);
      expect(calcPositioning(service, operation)).not.toBe(calcPositioning(service, diffOperation));
      expect(calcPositioning(service, operation)).not.toBe(calcPositioning(diffService, operation));
      expect(calcPositioning(service, operation)).not.toBe(calcPositioning(diffService, diffOperation));
      expect(calcPositioning(service, operation)).not.toBe(calcPositioning(service));
      expect(calcPositioning(service, operation)).toBe(firstResult);
      expect(calcPositioning(service)).not.toBe(firstResult);
      expect(calcPositioning(service)).toBe(calcPositioning(service));
    });

    it('does not recalculate rects for previously seen string', () => {
      svcMeasurements = genWidths([1, 2, 3, 4, 5]);
      opMeasurements = genWidths([4, 3, 2, 1]);
      const firstService = genStr(3);
      const secondService = genStr(2);
      const operation = genStr(opMeasurements.length);

      calcPositioning(firstService, operation);
      expect(measureSvc).toHaveBeenCalledTimes(3);
      expect(measureOp).toHaveBeenCalledTimes(opMeasurements.length);

      measureOp.mockClear();
      calcPositioning(secondService, operation);
      expect(measureSvc).toHaveBeenCalledTimes(5);
      expect(measureOp).not.toHaveBeenCalled();
    });
  });
});
