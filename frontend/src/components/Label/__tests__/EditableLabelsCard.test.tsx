import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableLabelsCard, parseLabel } from '../EditableLabelsCard';

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

  it('renders a key-only label (no value)', () => {
    render(<EditableLabelsCard {...defaultProps} labels={{ 'my-flag': '' }} />);
    expect(screen.getByText('my-flag')).toBeInTheDocument();
  });

  it('sorts labels alphabetically by key', () => {
    const labels = { zebra: 'z', alpha: 'a', mango: 'm' };
    const { container } = render(<EditableLabelsCard {...defaultProps} labels={labels} />);
    const labelTexts = Array.from(container.querySelectorAll('.pf-v6-c-label__content')).map(el => el.textContent);
    expect(labelTexts).toEqual(['alpha=a', 'mango=m', 'zebra=z']);
  });

  it('prioritizes istio labels when prioritizeIstio is true', () => {
    const labels = { version: 'v1', 'istio.io/rev': 'default', app: 'ratings' };
    const { container } = render(<EditableLabelsCard {...defaultProps} labels={labels} prioritizeIstio />);
    const labelTexts = Array.from(container.querySelectorAll('.pf-v6-c-label__content')).map(el => el.textContent);
    expect(labelTexts).toEqual(['istio.io/rev=default', 'app=ratings', 'version=v1']);
  });
});

describe('parseLabel', () => {
  it('parses a key=value pair', () => {
    expect(parseLabel('app=bookinfo')).toEqual(['app', 'bookinfo']);
  });

  it('parses a key-only label (no equals sign)', () => {
    expect(parseLabel('my-flag')).toEqual(['my-flag', '']);
  });

  it('trims whitespace from a key-only label', () => {
    expect(parseLabel('  my-flag  ')).toEqual(['my-flag', '']);
  });

  it('trims whitespace from key and value', () => {
    expect(parseLabel('  app = bookinfo  ')).toEqual(['app', 'bookinfo']);
  });

  it('returns undefined for an empty string', () => {
    expect(parseLabel('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(parseLabel('   ')).toBeUndefined();
  });

  it('returns undefined when equals sign is at position 0 (no key)', () => {
    expect(parseLabel('=value')).toBeUndefined();
  });

  it('allows an empty value after equals sign', () => {
    expect(parseLabel('key=')).toEqual(['key', '']);
  });
});
