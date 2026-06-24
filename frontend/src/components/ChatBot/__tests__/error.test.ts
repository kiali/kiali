import { getFetchErrorMessage } from '../error';

describe('getFetchErrorMessage', () => {
  it('returns detail string directly when detail is a plain string', () => {
    const result = getFetchErrorMessage({ json: { detail: 'Service unavailable' } });
    expect(result).toEqual({ message: 'Service unavailable' });
  });

  it('returns message and moreInfo when detail has response and cause fields', () => {
    const result = getFetchErrorMessage({
      json: {
        detail: {
          response: 'The LLM provider rejected the request',
          cause: 'Invalid API key'
        }
      }
    });
    expect(result).toEqual({
      message: 'The LLM provider rejected the request',
      moreInfo: 'Invalid API key'
    });
  });

  it('returns detail.message when detail is an object with only a message field', () => {
    const result = getFetchErrorMessage({ json: { detail: { message: 'Tool execution failed' } } });
    expect(result).toEqual({ message: 'Tool execution failed' });
  });

  it('falls back to the generic message using json.message when detail is absent', () => {
    const result = getFetchErrorMessage({ json: { message: 'Internal Server Error' } });
    expect(result.message).toContain('Internal Server Error');
  });

  it('falls back to the generic message using error.message when json is absent', () => {
    const result = getFetchErrorMessage({ message: 'Network request failed' });
    expect(result.message).toContain('Network request failed');
  });
});
