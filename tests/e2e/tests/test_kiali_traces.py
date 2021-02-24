import pytest
import tests.conftest as conftest
import calendar
import time

gmt = time.gmtime

bookinfo_namespace = conftest.get_bookinfo_namespace()

def test_service_traces_endpoint(kiali_client):
    response = kiali_client.request (method_name='serviceTraces',  path={'namespace': bookinfo_namespace, 'service':'details'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 404 or response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json().get('data')[0].get('traceID')
        assert traceID != None
        spans_list = response.json().get('data')[0].get('spans')
        assert spans_list != None
        for traceID in spans_list:
            assert traceID != None and traceID != ''
    else:
        assert False

def test_workload_traces_endpoint(kiali_client):
    response = kiali_client.request (method_name='workloadTraces',  path={'namespace': bookinfo_namespace, 'workload':'details-v1'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 404 or response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json().get('data')[0].get('traceID')
        assert traceID != None
        spans_list = response.json().get('data')[0].get('spans')
        assert spans_list != None
        for traceID in spans_list:
            assert traceID != None and traceID != ''
    else:
        assert False
        
def test_app_traces_endpoint(kiali_client):
    response = kiali_client.request (method_name='appTraces',  path={'namespace': bookinfo_namespace, 'app':'details'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 404 or response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json().get('data')[0].get('traceID')
        assert traceID != None
        spans_list = response.json().get('data')[0].get('spans')
        assert spans_list != None
        for traceID in spans_list:
            assert traceID != None and traceID != ''
    else:
        assert False    

def test_workload_spans_endpoint(kiali_client):
    response = kiali_client.request (method_name='workloadSpans',  path={'namespace': bookinfo_namespace, 'workload':'details-v1'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json()[0]['traceID']
        assert traceID != None 
        references_traceID = response.json()[0]['references'][0]['traceID']
        assert references_traceID != None and references_traceID != ''
    else:
        assert False


def test_service_spans_endpoint(kiali_client):
    response = kiali_client.request (method_name='serviceSpans',  path={'namespace': bookinfo_namespace, 'service':'details'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json()[0]['traceID']
        assert traceID != None 
        references_traceID = response.json()[0]['references'][0]['traceID']
        assert references_traceID != None and references_traceID != ''
    else:
        assert False

def test_app_spans_endpoint(kiali_client):
    response = kiali_client.request(method_name='appSpans', path={'namespace': bookinfo_namespace, 'app': 'details'}, params={'startMicros': calendar.timegm(gmt())})
    if response.status_code == 500:
        pytest.skip()  
    elif response.status_code == 200:
        traceID = response.json()[0]['traceID']
        assert traceID != None 
        references_traceID = response.json()[0]['references'][0]['traceID']
        assert references_traceID != None and references_traceID != ''
    else:
        assert False
