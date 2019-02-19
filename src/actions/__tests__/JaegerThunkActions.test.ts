import { convTagsLogfmt, getUnixTimeStampInMSFromForm, JaegerURLSearch } from '../JaegerThunkActions';
import { JAEGER_QUERY } from '../../config';
import moment from 'moment-timezone';

describe('JaegerThunkActions', () => {
  describe('Methods & Class', () => {
    describe('Method convTagsLogfmt', () => {
      it('convTagsLogfmt should return null if tags is empty', () => {
        expect(convTagsLogfmt('')).toEqual(null);
      });

      it('convTagsLogfmt should JSON stringify of the tags', () => {
        expect(convTagsLogfmt('error=true')).toEqual('{"error":"true"}');

        expect(convTagsLogfmt('http.status_code=200 error=true')).toEqual('{"http.status_code":"200","error":"true"}');
      });
    });

    describe('Method getUnixTimeStampInMSFromForm', () => {
      it('getUnixTimeStampInMSFromForm should return the correct start and end time in MS', () => {
        moment.tz.setDefault('UTC');
        const date = '2019-01-01';
        const startTime = '10:30';
        const endTime = '11:30';
        const result = getUnixTimeStampInMSFromForm(date, startTime, date, endTime);
        expect(result.start).toEqual('1546338600000000');
        expect(result.end).toEqual('1546342200000000');
      });
    });

    describe('Class JaegerURLSearch', () => {
      const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
      let jaegerURLclass;

      beforeEach(() => {
        jaegerURLclass = new JaegerURLSearch(url);
      });

      it('JaegerURLSearch constructor', () => {
        expect(jaegerURLclass.url).toEqual(
          `${url}${JAEGER_QUERY().PATH}?${JAEGER_QUERY().EMBED.UI_EMBED}=${JAEGER_QUERY().EMBED.VERSION}`
        );
      });

      it('JaegerURLSearch addQueryParam method with number value', () => {
        jaegerURLclass.addQueryParam('uiTimelineHideMinimap', 1);
        expect(jaegerURLclass.url).toEqual(
          `${url}${JAEGER_QUERY().PATH}?${JAEGER_QUERY().EMBED.UI_EMBED}=${
            JAEGER_QUERY().EMBED.VERSION
          }&uiTimelineHideMinimap=1`
        );
        jaegerURLclass.addQueryParam('uiTimelineHideSummary', '0');
        expect(jaegerURLclass.url).toEqual(
          `${url}${JAEGER_QUERY().PATH}?${JAEGER_QUERY().EMBED.UI_EMBED}=${
            JAEGER_QUERY().EMBED.VERSION
          }&uiTimelineHideMinimap=1&uiTimelineHideSummary=0`
        );
      });

      it('JaegerURLSearch addParam method', () => {
        jaegerURLclass.addParam('uiTimelineHideMinimap');
        expect(jaegerURLclass.url).toEqual(
          `${url}${JAEGER_QUERY().PATH}?${JAEGER_QUERY().EMBED.UI_EMBED}=${
            JAEGER_QUERY().EMBED.VERSION
          }&uiTimelineHideMinimap`
        );
      });
    });
  });
});
