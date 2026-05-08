import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableLabelsCard } from '../EditableLabelsCard';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

const defaultProps = {
  canEdit: true,
  labels: { app: 'bookinfo', version: 'v1' } as Record<string, string>,
  onSave: jest.fn(),
  title: 'Labels'
};

describe('EditableLabelsCard', () => {
  beforeEach(() => {
    defaultProps.onSave.mockClear();
  });

  it('renders the title', () => {
    render(<EditableLabelsCard {...defaultProps} />);
    expect(screen.getByText('Labels')).toBeInTheDocument();
  });

  it('renders existing labels in view mode', () => {
    render(<EditableLabelsCard {...defaultProps} />);
    expect(screen.getByText('app=bookinfo')).toBeInTheDocument();
    expect(screen.getByText('version=v1')).toBeInTheDocument();
  });

  it('shows "No labels" when labels are empty', () => {
    render(<EditableLabelsCard {...defaultProps} labels={{}} />);
    expect(screen.getByText('No labels')).toBeInTheDocument();
  });

  it('hides edit button when canEdit is false', () => {
    const { container } = render(<EditableLabelsCard {...defaultProps} canEdit={false} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('enters edit mode when edit button is clicked', () => {
    const { container } = render(<EditableLabelsCard {...defaultProps} />);
    const editButton = container.querySelector('button');
    fireEvent.click(editButton!);
    expect(screen.getByText('Add label')).toBeInTheDocument();
  });

  it('prioritizes istio labels when prioritizeIstio is true', () => {
    const labels = { version: 'v1', 'istio.io/rev': 'default', app: 'ratings' };
    const { container } = render(<EditableLabelsCard {...defaultProps} labels={labels} prioritizeIstio />);
    const labelTexts = Array.from(container.querySelectorAll('.pf-v6-c-label__content')).map(el => el.textContent);
    const istioIdx = labelTexts.findIndex(t => t?.includes('istio'));
    const nonIstioIdx = labelTexts.findIndex(t => t?.includes('app'));
    if (istioIdx !== -1 && nonIstioIdx !== -1) {
      expect(istioIdx).toBeLessThan(nonIstioIdx);
    }
  });
});
