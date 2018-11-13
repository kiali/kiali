
import tests.conftest as conftest


def test_assert_istio_has_kiali_clusterroles_on_istio(istio_cluster_role_biding=None):
    istio = conftest.get_istio_clusterrole_file()
    assert istio is not None


def test_assert_kiali_clusters_are_valid():
    kiali = conftest.get_kiali_clusterrole_file()
    assert kiali is not None


def test_assert_equivalence_cluster_roles():
    kiali = conftest.get_kiali_clusterrole_file()['rules']
    istio = conftest.get_istio_clusterrole_file()['rules']

    # Comparing if kiali has the same resources as Istio
    assert sorted(kiali[0]) == sorted(istio[0])
    assert sorted(kiali[1]) == sorted(istio[1])
    assert sorted(kiali[2]) == sorted(istio[2])



