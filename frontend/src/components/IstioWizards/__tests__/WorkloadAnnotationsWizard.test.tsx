import { render, screen, fireEvent } from '@testing-library/react';
import { WorkloadAnnotationsWizard } from '../WorkloadAnnotationsWizard';

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    if (opts && 'section' in opts) {
      return key.replace('{{section}}', opts.section as string);
    }
    return key;
  }
}));

const defaultProps = {
  canEdit: true,
  controllerAnnotations: { 'deployment.kubernetes.io/revision': '1' },
  isOpen: true,
  onClose: rstest.fn(),
  onSave: rstest.fn(),
  templateAnnotations: { 'proxy.istio.io/config': 'tracing: {}' }
};

describe('WorkloadAnnotationsWizard', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
  });

  it('renders two sections with correct headers', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} />);
    expect(screen.getByText('Controller Annotations')).toBeInTheDocument();
    expect(screen.getByText('Pod Template Annotations')).toBeInTheDocument();
  });

  it('renders controller and template annotations in their respective sections', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} />);
    const controllerSection = screen.getByTestId('controller-section');
    const templateSection = screen.getByTestId('template-section');
    expect(controllerSection).toBeInTheDocument();
    expect(templateSection).toBeInTheDocument();
  });

  it('calls onSave with separated controller and template maps', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} />);
    fireEvent.click(screen.getByTestId('save-button'));
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      { 'deployment.kubernetes.io/revision': '1' },
      { 'proxy.istio.io/config': 'tracing: {}' }
    );
  });

  it('calls onClose on cancel', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('validates empty keys in controller section', () => {
    render(
      <WorkloadAnnotationsWizard
        {...defaultProps}
        controllerAnnotations={{}}
        templateAnnotations={{ 'proxy.istio.io/config': 'tracing: {}' }}
      />
    );
    const controllerSection = screen.getByTestId('controller-section');
    const addButton = controllerSection.querySelector('[data-test="controller-add-more"]') as HTMLElement;
    fireEvent.click(addButton);
    fireEvent.click(screen.getByTestId('save-button'));
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('validates duplicate keys within a section', () => {
    render(
      <WorkloadAnnotationsWizard
        {...defaultProps}
        controllerAnnotations={{ note: 'one' }}
        templateAnnotations={{ 'proxy.istio.io/config': 'tracing: {}' }}
      />
    );
    const controllerKeyInputs = screen.getAllByPlaceholderText('Key');
    fireEvent.change(controllerKeyInputs[0], { target: { value: 'proxy.istio.io/config' } });
    fireEvent.click(screen.getByTestId('save-button'));
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('allows empty string values', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} templateAnnotations={{ 'sidecar.istio.io/inject': '' }} />);
    fireEvent.click(screen.getByTestId('save-button'));
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      { 'deployment.kubernetes.io/revision': '1' },
      { 'sidecar.istio.io/inject': '' }
    );
  });

  it('does not render modal when isOpen is false', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Controller Annotations')).not.toBeInTheDocument();
  });

  it('shows Close button when canEdit is false', () => {
    render(<WorkloadAnnotationsWizard {...defaultProps} canEdit={false} />);
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
  });
});
