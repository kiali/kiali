# OpenShift Service Mesh Console (OSSM Console)

:information_source: There is a [Users Guide](https://github.com/kiali/openshift-servicemesh-plugin/blob/main/docs/users-guide.md).

The OpenShift Service Mesh Console is a Webpack Plugin that integrates Kiali into the OpenShift Console. The official title of the project is "OpenShift Service Mesh Console" but you may see this abbreviated in documentation and code as "OSSMC", "ossmconsole", or "OSSM Console".

The main component is a plugin based on OpenShift Console [Dynamic plugin-ins](https://docs.openshift.com/container-platform/4.13/web_console/dynamic-plugin/overview-dynamic-plugin.html) framework. Installing and enabling the plugin will add OpenShift Service Mesh support into the OpenShift Console. The new "Service Mesh" menu item and tabs allow you to interact with your mesh via the Kiali user interface. Note that OSSMC may also work with upstream Istio installed (as opposed to OpenShift Service Mesh).

The main installation mechanism is the Kiali Operator.

## Platform Setup

These are the things you need before developers can start working with the OpenShift Service Mesh Console:

1. OpenShift cluster with OpenShift ServiceMesh or Istio installed.
2. Kiali Server deployed in the cluster
3. `oc` client available in the path
4. `podman` or `docker` client available in the path

## Operator

The OpenShift Service Mesh Console will be installed by end users using the Kiali Operator. More details can be found in the [Install Guild](https://github.com/kiali/openshift-servicemesh-plugin/blob/main/docs/install-guide.md). Developers can use the make targets found in the kiali repo (see below).

#### Quick Summary

Here is a summary for developers on how to get the Kiali Operator, Kiali Server, and OSSMC installed in your OpenShift cluster.

1. First run `make cluster-status` to expose the internal image registry and get the docker or podman command needed to log into the internal image registry.
2. Run the podman or docker login command that will log into the internal image registry.
3. Build and push the OSSMC plugin image. You must do this from within your local repo of https://github.com/kiali/openshift-servicemesh-plugin - so clone that repo locally, and from your clone's root directory on your local machine, run `make cluster-push` and that will do what needs to be done.
4. Build, push, and deploy the operator, Kiali, and plugin by running `make cluster-push operator-create kiali-create ossmconsole-create`

When you are finished and you want to uninstall the operator, Kiali, and plugin, run `make operator-delete`.
