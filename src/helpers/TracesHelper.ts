import * as API from '../services/Api';
import { JaegerTrace, JaegerResponse } from '../types/JaegerInfo';
import { transformTraceData } from '../components/JaegerIntegration/JaegerResults';

export const fetchTraces = (namespace: string, service: string, restParams: any): Promise<JaegerResponse> => {
  return API.getJaegerTraces(namespace, service, restParams).then(response => {
    const traces: JaegerTrace[] = [];
    if (response.data.data) {

      response.data.data.forEach(trace => {
        const data = transformTraceData(trace);
        if (data) {
          traces.push(data);
        }
      });
      var result: JaegerResponse = { data: traces, errors: response.data.errors };
      return result
    }
    return { data: null, errors: response.data.errors }
  });
};

export const fetchTrace = (namespace: string, service: string, traceId: string): Promise<JaegerResponse | null> => {
  return API.getJaegerTrace(namespace, service, traceId).then(response => {
    if (response.data.data) {
      const trace = transformTraceData(response.data.data[0]);
      return {data: trace? [trace]: null, errors: response.data.errors}
    }
    return {data: null, errors: response.data.errors}
  });
};
