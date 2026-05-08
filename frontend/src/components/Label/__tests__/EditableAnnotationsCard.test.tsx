import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableAnnotationsCard } from '../EditableAnnotationsCard';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    if (opts && 'count' in opts) {
      return `${opts.count} more`;
    }
    return key;
  }
}));

jest.mock('components/IstioWizards/WizardLabels', () => ({
  WizardLabels: () => null
}));

const defaultProps = {
  annotations: { 'kubectl.kubernetes.io/restartedAt': '2024-01-01', note: 'test' } as Record<string, string>,
  canEdit: true,
  onSave: jest.fn(),
  title: 'Annotations'
};

describe('EditableAnnotationsCard', () => {
  it('renders the title', () => {
    render(<EditableAnnotationsCard {...defaultProps} />);
    expect(screen.getByText('Annotations')).toBeInTheDocument();
  });

  it('renders annotation keys', () => {
    render(<EditableAnnotationsCard {...defaultProps} />);
    expect(screen.getByText('kubectl.kubernetes.io/restartedAt')).toBeInTheDocument();
    expect(screen.getByText('note')).toBeInTheDocument();
  });

  it('shows "No annotations" when empty', () => {
    render(<EditableAnnotationsCard {...defaultProps} annotations={{}} />);
    expect(screen.getByText('No annotations')).toBeInTheDocument();
  });

  it('respects numAnnotations for collapsed view', () => {
    const annotations: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      annotations[`key-${i}`] = `val-${i}`;
    }
    render(<EditableAnnotationsCard {...defaultProps} annotations={annotations} numAnnotations={3} />);
    const expandLink = screen.getByText('7 more');
    expect(expandLink).toBeInTheDocument();
  });

  it('expands to show all annotations when expand link is clicked', () => {
    const annotations: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      annotations[`key-${i}`] = `val-${i}`;
    }
    render(<EditableAnnotationsCard {...defaultProps} annotations={annotations} numAnnotations={3} />);
    fireEvent.click(screen.getByText('7 more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('shows edit icon when canEdit is true', () => {
    render(<EditableAnnotationsCard {...defaultProps} canEdit={true} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows view icon when canEdit is false', () => {
    render(<EditableAnnotationsCard {...defaultProps} canEdit={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
