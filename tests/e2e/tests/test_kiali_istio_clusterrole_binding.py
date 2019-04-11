
import tests.conftest as conftest


def _test_assert_istio_has_kiali_clusterroles_on_istio():
    istio = conftest.get_istio_clusterrole_file()
    assert istio is not None


def _test_assert_kiali_openshift_clusters_are_valid():
    kiali_openshift = conftest.get_kiali_clusterrole_file(file_type='Openshift')
    assert kiali_openshift is not None


def _test_assert_kiali_kurbenetes_clusters_are_valid():
    kiali_kubernetes = conftest.get_kiali_clusterrole_file(file_type="Kubernetes")
    assert kiali_kubernetes is not None


def _test_assert_equivalence_cluster_roles():
    kiali_openshift = conftest.get_kiali_clusterrole_file(file_type='Openshift').get('rules')
    kiali_kubernetes = conftest.get_kiali_clusterrole_file(file_type='Kubernetes').get('rules')

    istio = conftest.get_istio_clusterrole_file()['rules']

    # Comparing if kiali openshift clusterrole has the same resources as Istio clusterrole
    assert sorted(kiali_openshift[0]) == sorted(istio[0])
    assert sorted(kiali_openshift[1]) == sorted(istio[1])
    assert sorted(kiali_openshift[2]) == sorted(istio[2])

    # Comparing if kiali kubernetes clusterrole has the same resources as Istio clusterrole
    assert sorted(kiali_kubernetes[0]) == sorted(istio[0])
    assert sorted(kiali_kubernetes[1]) == sorted(istio[1])
    assert sorted(kiali_kubernetes[2]) == sorted(istio[2])






