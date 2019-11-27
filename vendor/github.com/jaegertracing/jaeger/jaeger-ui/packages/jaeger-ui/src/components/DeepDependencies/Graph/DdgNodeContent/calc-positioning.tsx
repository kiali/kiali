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

/*
 * CONTEXT
 * CSS3 does not support text wrap that adheres to border radius. Even if it did, CSS3 does not support
 * proportional height and width for containers that are sized by `fit-content`. Subsequently, we need to
 * calculate our own circle sizing.
 *
 * Ideally, we would fit as many words as we can per chord of the circle, with lines closer to the center
 * being wider than lines at the top or bottom. It would be very expensive to calculate the minimum radius for
 * hundreds or thousands of nodes that each have multiple words and therefore many possible chords.
 *
 * Instead, a much cheaper compromise is to calculate the smallest circle that contains one or two (depending
 * on if the operation is rendered) vertically-stacked, horizontally-centered rectangle(s).
 *
 * For one rectangle, the radius would be half of the diagonal of the rectangle.
 *
 * For two rectangles, we know the center would be on a line that vertically bisects the two given rectangles.
 * Which means we know cx.
 * The center should also be equidistant from the bottom left corner of the lower rectangle, and the top right
 * corner of the upper rectangle.
 * Which means we can calculate cy based on the widths and heights of the two rectangles.
 * With cx,cy and one point on the circle, such as the lower left corner of the lower rectangle, we can
 * calculate the radius.
 * One caveat: if cy is too low, the circle will not include the upper corners of the lower rectangle, or if
 * cy is too high, the circle will not include the lower corners of the upper rectangle.
 * In this case, the circle must be enlarged to fully encompass the overflowing rectangle, and the circle
 * would instead be exclusively based on that rectangle.
 *
 * There are multiple different rectangles that can be formed to contain a string. These are calculated by
 * calcRects. All different combinations of service and operation rectangles are used to calculate the
 * smallest radius containing both.
 */

import _memoize from 'lodash/memoize';

import { FONT, FONT_SIZE, LINE_HEIGHT, OP_PADDING_TOP, WORD_RX } from './constants';

type TRect = { height: number; width: number };

let svcSpan: HTMLSpanElement | undefined;

/*
 * Mesaurements for the words comprising a service are measured by a span that is mounted out of a view.
 * Using a canvas would remove the requirement that the measuring container is part of the DOM, however canvas
 * measurements proved to be inaccurate by small yet impactful margins. The svcSpan and opSpan share the same
 * font and font size, but the service words are bolded (weight: '500'). To reduce clutter and time, the span
 * is only added once circles are being measured, and is reused for subsequent measurements.
 */
// exported for tests
export function _initSvcSpan() {
  if (svcSpan) return svcSpan;
  svcSpan = document.createElement('span');
  svcSpan.style.position = 'absolute';
  svcSpan.style.top = `-${FONT_SIZE * LINE_HEIGHT}px`;
  svcSpan.style.fontFamily = FONT;
  svcSpan.style.fontWeight = '500';
  document.body.appendChild(svcSpan);
  return svcSpan;
}

let opSpan: HTMLSpanElement | undefined;

/*
 * Mesaurements for the words comprising a operation are measured by a span that is mounted out of a view.
 * Using a canvas would remove the requirement that the measuring container is part of the DOM, however canvas
 * measurements proved to be inaccurate by small yet impactful margins. The svcSpan and opSpan share the same
 * font and font size, but the operation words are not bolded. To reduce clutter and time, the span is only
 * added once circles are being measured, and is reused for subsequent measurements.
 */
// exported for tests
export function _initOpSpan() {
  if (opSpan) return opSpan;
  opSpan = document.createElement('span');
  opSpan.style.position = 'absolute';
  opSpan.style.top = `-${FONT_SIZE * LINE_HEIGHT}px`;
  opSpan.style.fontFamily = FONT;
  opSpan.style.fontWeight = '500';
  document.body.appendChild(opSpan);
  return opSpan;
}

/*
 * Calculates the width of the smallest rectangle that can contain the given word lengths over a specified
 * number of lines.
 *
 * @param {number[]} lengths - The lengths of the words that need to be split across lines.
 * @param {number} lines - The number of lines to contain the given word lengths.
 * @param {[number=0]} longestThusFar - The longest line from previous calls to calcWidth in the same
 *     recursive call stack.
 * @returns {number} - Width of narrowest rectangle that contains given words across given lines.
 */
function calcWidth(lengths: number[], lines: number, longestThusFar: number = 0): number {
  // Base case: all words on one line means line length is total word length
  const total = lengths.reduce((sum, curr) => curr + sum, 0);
  if (lines === 1) return total;

  // The first line needs to be at least as long as the first word. Then as long as more words fit before the
  // minimum rectangle width, they must be included on the first line.
  const minRectWidth = Math.max(longestThusFar, total / lines);
  let firstOptionLength = 0;
  let i = 0;
  do {
    firstOptionLength += lengths[i++];
  } while (firstOptionLength + lengths[i] < minRectWidth);

  // The first option does not increase the overall length, but because future words may be lengthy, all
  // options from this first option until the line is the majority of the total length, or until there are as
  // many remaining words as there are remaining lines, must be considered.
  const firstLineOptions = [{ width: firstOptionLength, start: i }];
  while (lengths.length - i >= lines && firstLineOptions[firstLineOptions.length - 1].width < total / 2) {
    firstLineOptions.push({
      width: firstLineOptions[firstLineOptions.length - 1].width + lengths[i++],
      start: i,
    });
  }

  // Return the minimum width.
  return Math.min(
    // For each option, calculate the width of the words that are not on the first line, contained on one
    // fewer line than we started with.
    ...firstLineOptions.map(({ width, start }) =>
      // The width of the resulting rectangle for each option is either its own width, or the width of the
      // balance, whichever is greater.
      Math.max(calcWidth(lengths.slice(start), lines - 1, Math.max(longestThusFar, width)), width)
    )
  );
}

/*
 * Returns all measurements for possible bounding rectangles for the given string, up until the first
 * rectangle that is taller than it is wide. Once the height surpasses the width, there is no reason to
 * continue as the resulting radius is guaranteed to be increasing.
 *
 * @param {string} str - String which rectangles must contain.
 * @param {HTMLSpanElement} span - Span used to measure lengths of str.
 * @returns {TRect[]} - Possible bounding rectangles.
 */
const calcRects = _memoize(
  function calcRects(str: string, span: HTMLSpanElement): TRect[] {
    const lengths = (str.match(WORD_RX) || [str]).map(s => {
      span.innerHTML = s; // eslint-disable-line no-param-reassign
      return span.getClientRects()[0].width;
    });

    const rects: TRect[] = [];
    for (let lines = 1; lines <= lengths.length; lines++) {
      const width = calcWidth(lengths, lines);
      const height = lines * FONT_SIZE * LINE_HEIGHT;
      if (!rects.length || width < rects[rects.length - 1].width) rects.push({ height, width });
      if (height > width) break;
    }
    return rects;
  },
  (str: string, span: HTMLSpanElement) => `${str}\t${span.style.fontWeight}`
);

const sq = (n: number): number => n ** 2;
const diagonal = (rect: TRect): number => Math.sqrt(sq(rect.height) + sq(rect.width));

type TSmallestRadiusRV = { radius: number; svcWidth: number; opWidth?: number; svcMarginTop: number };

/*
 * Calculates the smallest radius that contains one of the svcRects and one of the opRects if provided.
 *
 * @param {TRect[]} svcRects - Possible bounding rectangles for service name.
 * @param {TRect[]} [opRects] - Possible bounding rectangles for operation name.
 * @returns {Object} - Object with smallest radius, widths of chosen service and operation rectangle, and how
 *     much space to leave above first rectangle.
 */
function smallestRadius(svcRects: TRect[], opRects?: TRect[]): TSmallestRadiusRV {
  // If there isn't an operation, the radius is simply half the shortest diagonal of the svcRects.
  if (!opRects) {
    let minDiagonal = diagonal(svcRects[0]);
    let { height, width } = svcRects[0];

    for (let i = 1; i < svcRects.length; i++) {
      const radius = diagonal(svcRects[i]);
      if (radius < minDiagonal) {
        minDiagonal = radius;
        width = svcRects[i].width;
        height = svcRects[i].height;
      }
    }

    return {
      radius: minDiagonal / 2,
      svcWidth: width,
      svcMarginTop: (minDiagonal - height) / 2,
    };
  }

  // Otherwise, calculate the smallest radius of possible radii from all combinations of svcRect and opRect.
  let rv: TSmallestRadiusRV | undefined;
  svcRects.forEach(svcRect => {
    opRects.forEach(opRect => {
      let radius;
      let svcMarginTop;
      const totalHeight = svcRect.height + opRect.height + OP_PADDING_TOP;

      // Calculate height of point on bisecting line, relative to bottom of opRect
      const cy = (sq(svcRect.width / 2) - sq(opRect.width / 2)) / (2 * totalHeight) + totalHeight / 2;

      // If the center is too low, the top of the opRect will not be within the circle.
      if (cy < opRect.height / 2) {
        radius = diagonal(opRect) / 2;
        svcMarginTop = radius - OP_PADDING_TOP - opRect.height / 2 - svcRect.height;

        // If the center is too high, the bottom of the svcRect will not be within the circle.
      } else if (cy > totalHeight - svcRect.height / 2) {
        radius = diagonal(svcRect) / 2;
        svcMarginTop = radius - svcRect.height / 2;

        // else both rectangles are enclosed.
      } else {
        radius = Math.sqrt(sq(opRect.width / 2) + sq(cy));
        svcMarginTop = radius - totalHeight + cy;
      }

      if (!rv || rv.radius > radius) {
        rv = { radius, svcWidth: svcRect.width, opWidth: opRect.width, svcMarginTop };
      }
    });
  });

  /* istanbul ignore next : Unreachable error to appease TS */
  if (!rv) throw new Error('Given 0 svcRects and/or 0 opRects');
  return rv;
}

const calcPositioning: (service: string, operation?: string | null) => TSmallestRadiusRV = _memoize(
  function calcPositioningImpl(service: string, operation?: string | null) {
    const svcRects = calcRects(service, _initSvcSpan());
    const opRects = operation ? calcRects(operation, _initOpSpan()) : undefined;

    return smallestRadius(svcRects, opRects);
  },
  (service: string, operation?: string | null) => `${service}\t${operation}`
);

export default calcPositioning;
