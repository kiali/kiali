import { PromisesRegistry } from '../CancelablePromises';

describe('Cancelable promises', () => {
  it('should resolve as standard promise', () => {
    const promises = new PromisesRegistry();
    const initialPromise = new Promise<boolean>(resolve => setTimeout(() => resolve(true), 1));
    return promises.register('test', initialPromise).then(result => expect(result).toBe(true));
  });

  it('should be canceled before resolving', done => {
    const promises = new PromisesRegistry();
    const initialPromise = new Promise<boolean>(resolve => setTimeout(() => resolve(true), 1));
    promises
      .register('test', initialPromise)
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
        done();
      });
    promises.cancelAll();
  });

  it('should cancel the previous one', () => {
    const promises = new PromisesRegistry();
    const firstPromise = new Promise<number>(resolve => setTimeout(() => resolve(1), 1));
    const secondPromise = new Promise<number>(resolve => setTimeout(() => resolve(2), 1));
    promises
      .register('test', firstPromise)
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
      });
    return promises.register('test', secondPromise).then(result => expect(result).toBe(2));
  });

  it('should not cancel the previous one with different keys', () => {
    const promises = new PromisesRegistry();
    const firstPromise = new Promise<number>(resolve => setTimeout(() => resolve(1), 1));
    const secondPromise = new Promise<number>(resolve => setTimeout(() => resolve(2), 1));
    const r1 = promises.register('first', firstPromise);
    const r2 = promises.register('second', secondPromise);
    return Promise.all([r1, r2]).then(result => expect(result).toEqual([1, 2]));
  });

  it('should resolve promises with registerAll', () => {
    const promises = new PromisesRegistry();
    const p1 = new Promise<boolean>(resolve => setTimeout(() => resolve(true), 1));
    const p2 = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1));
    return promises.registerAll('test', [p1, p2]).then(result => expect(result).toEqual([true, false]));
  });

  it('should be canceled before resolving with registerAll', done => {
    const promises = new PromisesRegistry();
    const p1 = new Promise<boolean>(resolve => setTimeout(() => resolve(true), 1));
    const p2 = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1));
    promises
      .registerAll('test', [p1, p2])
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
        done();
      });
    promises.cancelAll();
  });

  it('should resolve chained promises alone', () => {
    const promises = new PromisesRegistry();
    const promiseGen = x => new Promise<number>(resolve => setTimeout(() => resolve(x + 1), 1));
    return promises.registerChained('test', 0, promiseGen).then(result => expect(result).toBe(1));
  });

  it('should resolve several chained promises', () => {
    const promises = new PromisesRegistry();
    const promiseGen = x => new Promise<number>(resolve => setTimeout(() => resolve(x + 1), 1));
    promises.registerChained('test', 0, promiseGen);
    promises.registerChained('test', 0, promiseGen);
    promises.registerChained('test', 0, promiseGen);
    return promises.registerChained('test', 0, promiseGen).then(result => expect(result).toBe(4));
  });

  it('should cancel several chained promises', done => {
    const promises = new PromisesRegistry();
    const promiseGen = x => new Promise<number>(resolve => setTimeout(() => resolve(x + 1), 1));
    promises
      .registerChained('test', 0, promiseGen)
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
      });
    promises
      .registerChained('test', 0, promiseGen)
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
        done();
      });
    promises.cancelAll();
  });

  it('should cancel after first chained promises', done => {
    const promises = new PromisesRegistry();
    const promiseGen = time => x => new Promise<number>(resolve => setTimeout(() => resolve(x + 1), time));
    promises.registerChained('a', 0, promiseGen(5)).then(() => promises.cancelAll());
    promises
      .registerChained('a', 0, promiseGen(10))
      .then(() => {
        throw new Error('Not expected to come here');
      })
      .catch(err => {
        expect(err.isCanceled).toBe(true);
        done();
      });
  });
});
