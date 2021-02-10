import { allMatchTEST, getExprTEST, replaceXCodeTEST } from '../HealthConfig';

describe('#getExprTEST', () => {
  it('getExprTEST should return allMatch if undefined value', () => {
    expect(getExprTEST(undefined)).toBe(allMatchTEST);
  });

  it('getExprTEST should return allMatch if value is empty', () => {
    expect(getExprTEST('')).toBe(allMatchTEST);
  });

  it('getExprTEST should return Regex if value is not empty', () => {
    expect(getExprTEST('bookinfo')).toStrictEqual(new RegExp('bookinfo'));
  });

  it('getExprTEST should return Regex if value is Regexp', () => {
    expect(getExprTEST(new RegExp('bookinfo'))).toStrictEqual(new RegExp('bookinfo'));
  });

  it('getExprTEST should return allMatch if value is Regexp empty', () => {
    expect(getExprTEST(new RegExp(''))).toStrictEqual(allMatchTEST);
  });

  it('Check that default backend is converted correctly', () => {
    const backendGo = '^[4-5]\\d\\d$';
    expect(getExprTEST(backendGo, true)).toStrictEqual(/^[4-5]\d\d$/);
  });

  it('Check that X is converted correctly', () => {
    const backendGo = '[45]XX';
    expect(getExprTEST(backendGo, true)).toStrictEqual(/[45]\d\d/);
  });

  it('Check that x is converted correctly', () => {
    const backendGo = '[45]xx';
    const expr = getExprTEST(backendGo, true);
    expect(expr).toStrictEqual(/[45]\d\d/);
    expect(expr.test('404')).toBeTruthy();
    expect(expr.test('501')).toBeTruthy();
    expect(expr.test('603')).toBeFalsy();
  });

  it('Check that replaceXCode convert correctly', () => {
    var backendGo = '[45]XX';
    expect(replaceXCodeTEST(backendGo)).toStrictEqual('[45]\\d\\d');

    backendGo = '[45]xx';
    expect(replaceXCodeTEST(backendGo)).toStrictEqual('[45]\\d\\d');
  });
});
