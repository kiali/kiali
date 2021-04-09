import pytest
import tests.conftest as conftest
import calendar
import time
from utils.common_utils import common_utils

TIME = calendar.timegm(time.gmtime())
bookinfo_namespace = conftest.get_bookinfo_namespace()

def test_logs_container_istio_proxy(kiali_client):
    lines = 50
    pod_id = common_utils.get_pod_id(kiali_client=kiali_client, namespace=bookinfo_namespace, pod_name='details-v1')
    PARAMS={'container':'istio-proxy', 'since_time':TIME, 'tailLines':lines}
    response = common_utils.get_response(kiali_client, method_name='podLogs', path={'namespace':bookinfo_namespace, 'pod':pod_id}, params=PARAMS)

    validate_response_content(response, lines)

def test_logs_container_details(kiali_client):
    lines = 25
    pod_id = common_utils.get_pod_id(kiali_client=kiali_client, namespace=bookinfo_namespace, pod_name='reviews-v1')
    PARAMS={'container':'reviews', 'since_time':TIME, 'tailLines':lines}
    response = common_utils.get_response(kiali_client, method_name='podLogs', path={'namespace':bookinfo_namespace, 'pod':pod_id}, params=PARAMS)

    validate_response_content(response, lines)

def test_logs_invalid_invalid_container_negative(kiali_client):
    lines = '50'
    pod_id = common_utils.get_pod_id(kiali_client=kiali_client, namespace=bookinfo_namespace, pod_name='reviews-v1')
    PARAMS={'container':'invalidContainer', 'since_time':TIME, 'tailLines':lines}
    response = common_utils.get_response(kiali_client, method_name='podLogs', path={'namespace':bookinfo_namespace, 'pod':pod_id}, params=PARAMS, status_code_expected=500)

    assert 'is not valid for pod' in response.text

def test_logs_invalid_line_count_negative(kiali_client):
    lines = '*50'
    pod_id = common_utils.get_pod_id(kiali_client=kiali_client, namespace=bookinfo_namespace, pod_name='reviews-v1')
    PARAMS={'container':'details', 'since_time':TIME, 'tailLines':lines}
    response = common_utils.get_response(kiali_client, method_name='podLogs', path={'namespace':bookinfo_namespace, 'pod':pod_id}, params=PARAMS, status_code_expected=500)

    assert 'Invalid tailLines' in response.text

#############

def validate_response_content(response=None, lines=None):
    entries = response.json().get('entries')
    assert len(entries) <= lines
    for i in entries:
        assert i.get('message') is not None
        assert i.get('severity') is not None
        assert i.get('timestamp') is not None