import { render, screen } from '@testing-library/react';
import { CheckConfigComp } from '../DiscoveryTracingConfig';
import type { TracingCheck } from '../../../types/TracingInfo';

rstest.mock('../../../services/Api', () => ({
  getDiagnoseStatus: rstest.fn()
}));

rstest.mock('../../Kiosk/KioskActions', () => ({
  isParentKiosk: () => false
}));

rstest.mock('utils/I18nUtils', () => ({
  t: (value: string) => value,
  tMap: (value: Record<string, string>) => value,
  useKialiTranslation: () => ({ t: (value: string) => value })
}));

const renderDiscovery = (tracingDiagnose: TracingCheck): void => {
  render(
    <CheckConfigComp
      cluster="test"
      externalServices={[]}
      kiosk=""
      setTracingDiagnose={rstest.fn()}
      tracingDiagnose={tracingDiagnose}
    />
  );
};

describe('DiscoveryTracingConfig', () => {
  it('shows a ready backend alongside a failed query', () => {
    renderDiscovery({
      logLine: [],
      message: '',
      queryAPI: { status: 'failed' },
      readiness: { httpStatus: 200, status: 'passed' }
    });

    expect(screen.getByTestId('tracing-readiness-result')).toHaveTextContent('Ready');
    expect(screen.getByTestId('tracing-query-result')).toHaveTextContent('Failed');
  });

  it('shows unverified readiness alongside a verified query', () => {
    renderDiscovery({
      logLine: [],
      message: '',
      queryAPI: { status: 'passed' },
      readiness: { httpStatus: 401, status: 'unverified' }
    });

    expect(screen.getByTestId('tracing-readiness-result')).toHaveTextContent(
      'Unverified. The readiness endpoint requires authentication.'
    );
    expect(screen.getByTestId('tracing-query-result')).toHaveTextContent('Verified');
  });
});
