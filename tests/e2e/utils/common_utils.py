import tests.conftest as conftest
import pytest

class common_utils():

    def get_pod_id(kiali_client=None, namespace=None, pod_name=None):
        try:
            response = common_utils.get_response(kiali_client, method_name='workloadDetails',
                                         path={'namespace': namespace, 'workload': pod_name})
            pod_id = response.json().get('pods')[0].get('name')
            assert pod_name in pod_id, "Expected pod name: {}   Actual pod ID: {}.format(pod_name, pod_id"
        except AssertionError:
            pytest.fail(response.content)

        return pod_id


    def get_response(kiali_client=None, method_name=None, path=None, params=None, data=None, status_code_expected=200, http_method='GET'):
        response = kiali_client.request(method_name=method_name, path=path, params=params, data=data, http_method=http_method)
        assert response is not None
        try:
            assert response.status_code == status_code_expected
        except AssertionError:
            pytest.fail(response.content)
        return response