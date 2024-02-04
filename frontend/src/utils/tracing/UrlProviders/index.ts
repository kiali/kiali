import { isTempoService, TempoUrlProvider } from './Tempo';
import { isJaegerService, JaegerUrlProvider } from './Jaeger';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { TracingUrlProvider } from '../../../types/Tracing';

export function GetTracingUrlProvider(
  externalServices: ExternalServiceInfo[],
  provider?: string
): TracingUrlProvider | undefined {
  const svc = provider
    ? externalServices.find(service => service.name === provider)
    : externalServices.find(service => ['tempo', 'jaeger'].includes(service.name.toLowerCase()));
  if (!svc) {
    return undefined;
  }

  let urlProvider: TracingUrlProvider | undefined = undefined;
  if (isTempoService(svc)) {
    urlProvider = new TempoUrlProvider(externalServices);
  }
  if (isJaegerService(svc)) {
    urlProvider = new JaegerUrlProvider(svc);
  }
  return urlProvider && urlProvider.valid ? urlProvider : undefined;
}
