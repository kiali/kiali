import * as React from 'react';
import { render } from '@testing-library/react';
import { Label } from '../Label';

const mockBadge = (name = 'my_key', value = 'my_value'): ReturnType<typeof render> => {
  return render(<Label value={value} name={name} />);
};

describe('#Badge render correctly with data', () => {
  it('should render badge', () => {
    const key = 'app';
    const value = 'bookinfo';
    const { container } = mockBadge(key, value);

    expect(container).toMatchSnapshot();
    expect(container).toHaveTextContent(`${key}=${value}`);
  });
});
