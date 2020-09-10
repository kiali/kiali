import { allMatchTEST, getExprTEST } from '../HealthConfig';

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
    expect(getExprTEST(backendGo)).toStrictEqual(/^[4-5]\d\d$/);
  });
});
