import { render, screen, fireEvent } from '@testing-library/react';
import { EditableLabelsCard, parseLabel } from '../EditableLabelsCard';

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

const defaultProps = {
  canEdit: true,
  labels: { app: 'bookinfo', version: 'v1' } as Record<string, string>,
  onSave: rstest.fn(),
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

  it('reports when editing starts', () => {
    const onEditingChange = rstest.fn();
    render(<EditableLabelsCard {...defaultProps} onEditingChange={onEditingChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));

    expect(onEditingChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('reports that editing ended after saving valid labels', () => {
    const onEditingChange = rstest.fn();
    render(<EditableLabelsCard {...defaultProps} onEditingChange={onEditingChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(defaultProps.onSave).toHaveBeenCalledWith(defaultProps.labels);
    expect(onEditingChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole('button', { name: 'Edit labels' })).toBeInTheDocument();
  });

  it('reports that editing ended after cancelling without saving', () => {
    const onEditingChange = rstest.fn();
    render(<EditableLabelsCard {...defaultProps} onEditingChange={onEditingChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(onEditingChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole('button', { name: 'Edit labels' })).toBeInTheDocument();
  });

  it('keeps reporting editing while validation prevents saving', () => {
    const onEditingChange = rstest.fn();
    render(<EditableLabelsCard {...defaultProps} onEditingChange={onEditingChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Labels must have non-empty keys')).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(onEditingChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
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

  it('keeps prioritized labels ahead of numeric keys and preserves alphabetical ordering', () => {
    const labels = { '2': 'two', '10': 'ten', 'istio.io/rev': 'default' };
    const { container } = render(<EditableLabelsCard {...defaultProps} labels={labels} prioritizeIstio />);

    const labelTexts = Array.from(container.querySelectorAll('.pf-v6-c-label__text')).map(node => node.textContent);
    expect(labelTexts).toEqual(['istio.io/rev=default', '10=ten', '2=two']);
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
