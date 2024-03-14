# Installing Istio with the Latest Sail and Kiali Operators

To install Istio (including Kiali), use the script `install-ossm-release.sh`. This will utilize the Sail operator and Kiali operator to install the latest released images via OLM using either the public Red Hat repository or public Community repository.

Here's what you need to do in order to install everything.

First, install a Kubernetes cluster and make sure you do not already have Istio or Kiali installed. _(Note: currently non-OpenShift clusters are not supported. When the Sail operator is published on OperatorHub.io, then these scripts should be able to work with minor updates). So for now you need to use OpenShift._

Second, if using OpenShift, log into this cluster as a cluster admin user via 'oc'. Otherwise, make sure your current kube context is pointing to your Kubernetes cluster.

Now install the required operators:

```
./install-ossm-release.sh install-operators
```

Once the operators have been given time to start up, now install a control plane with Istio and Kiali:

```
./install-ossm-release.sh install-istio
```

Pass in `--help` for available options.

## Uninstall

To uninstall, use the `delete-istio` and `delete-operators` commands to the `./install-ossm-release.sh` script.
