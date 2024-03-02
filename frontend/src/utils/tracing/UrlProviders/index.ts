import { isTempoService, TempoUrlProvider } from './Tempo';
import { isJaegerService, JaegerUrlProvider } from './Jaeger';
import { ExternalServiceInfo } from 'types/StatusState';
import { JAEGER, TEMPO, TracingUrlProvider } from 'types/Tracing';

// Get a tracing url provider, assuming some is configured
export function GetTracingUrlProvider(
  externalServices: ExternalServiceInfo[],
  provider?: string
): TracingUrlProvider | undefined {
  // If we're passed the name of specific provider then find and use that provider
  // otherwise simply find any valid provider. Only the Nav Menu currently requests
  // a tracing url without explicitly passing a provider.
  const svc = provider
    ? externalServices.find(service => service.name === provider)
    : externalServices.find(service => [TEMPO, JAEGER].includes(service.name.toLowerCase()));
  if (!svc) {
    return undefined;
  }

  // Now we've got a tracing external service, figure out what kind and create
  // the wanted url provider
  let urlProvider: TracingUrlProvider | undefined = undefined;
  if (isTempoService(svc)) {
    urlProvider = new TempoUrlProvider(svc, externalServices);
  }
  if (isJaegerService(svc)) {
    urlProvider = new JaegerUrlProvider(svc);
  }

  // Test the URL provider is valid. If it isn't return undefined because an invalid
  // URL provider won't generate usable links
  return urlProvider && urlProvider.valid ? urlProvider : undefined;
}
