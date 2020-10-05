import { JaegerTrace } from 'types/JaegerInfo';
import { average } from './MathUtils';

export const averageSpanDuration = (trace: JaegerTrace): number | undefined => {
  const spansWithDuration = trace.spans.filter(s => s.duration && s.duration > 0);
  return average(spansWithDuration, span => span.duration);
};

export const isSimilarTrace = (t1: JaegerTrace, t2: JaegerTrace): boolean => {
  if (t1.spans.length === 0 || t2.spans.length === 0) {
    // Shouldn't happen... but avoid /0 anyway
    return false;
  }
  // Similarity algorithm:
  //  First criteria: if numbers of spans are close
  //  Second criteria: we'll count the number of occurrences of operations per trace, and look at the highest occuring operations.
  //  The closest their count are, the more similar the traces are.
  const nbSpansScore = distanceScore(t1.spans.length, t2.spans.length);
  type OpOccur = { op: string; t1: number; t2: number };
  const countOperations = new Map<String, OpOccur>();
  t1.spans.forEach(s => {
    const counter = countOperations.get(s.operationName);
    if (counter) {
      counter.t1++;
    } else {
      countOperations.set(s.operationName, { op: s.operationName, t1: 1, t2: 0 });
    }
  });
  t2.spans.forEach(s => {
    const counter = countOperations.get(s.operationName);
    if (counter) {
      counter.t2++;
    } else {
      countOperations.set(s.operationName, { op: s.operationName, t1: 0, t2: 1 });
    }
  });
  const values = Array.from(countOperations.values());
  const operationSimilarityScore = (counterGetter: (counter: OpOccur) => number): number => {
    const sorted = values.sort((a, b) => counterGetter(b) - counterGetter(a));
    let score = 0;
    const total = Math.min(4, sorted.length);
    for (let i = 0; i < total; i++) {
      score += distanceScore(sorted[i].t1, sorted[i].t2);
    }
    return score / total;
  };
  const score1 = operationSimilarityScore(counter => counter.t1);
  const score2 = operationSimilarityScore(counter => counter.t2);
  const total = (nbSpansScore + score1 + score2) / 3;
  // Arbitrary threshold: score below 0.3 means "similar"
  return total < 0.3;
};

const distanceScore = (n1: number, n2: number): number => {
  // Some score of how two numbers are "close" to each other
  return Math.abs(n1 - n2) / Math.max(1, Math.max(n1, n2));
};
