import * as React from 'react';
import { render } from '@testing-library/react';
import { Labels } from '../Labels';

const mockBadge = (labels: { [key: string]: string }): ReturnType<typeof render> => {
  return render(<Labels labels={labels} />);
};

describe('#Labels render correctly with data', () => {
  it('should render badges with More labels link', () => {
    const { container } = mockBadge({
      app: 'bookinfo',
      version: 'v1',
      env: 'prod',
      team: 'A'
    });

    expect(container).toMatchSnapshot();
  });

  it('should render badges without More labels link', () => {
    const { container } = mockBadge({
      app: 'bookinfo',
      version: 'v1'
    });

    expect(container).toMatchSnapshot();
  });
});
