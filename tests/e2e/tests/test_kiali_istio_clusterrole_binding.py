
import tests.conftest as conftest


def test_assert_kiali_has_clusterroles_on_istio():
    istio_cluster_role_biding = conftest.get_istio_clusterrole_file()

    assert istio_cluster_role_biding is not None

