# Installing Istio with the Latest Sail and Kiali Operators

## Quick installation guide

To install Istio (including Kiali), use the script `install-ossm-release.sh`. This will utilize the Sail operator and Kiali operator to install the latest released images via OLM using either the Red Hat repository or the public Community repository or the public OperatorHub.io.

Here's what you need to do in order to install everything.

First, install an OpenShift or Kubernetes cluster and make sure you do not already have Istio or Kiali installed.

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

## Detailed steps for a vanilla Kubernetes (not OpenShift)

* Requirements: the kiali source repo git cloned locally.

These steps will get Sail operator and its Istio installation, Kiali operator and Kiali UI, along with Tempo operator and Tempo (for tracing backend and JaegerUI), Grafana, and Prometheus. It also installs bookinfo and adds the auto injection label. 
A loadBalancer is added to have access to the Jaeger UI.

1. `hack/k8s-minikube.sh --load-balancer-addrs "70-84" start` 
2. `hack/istio/sail/install-ossm-release.sh -c kubectl install-operators` 
3. `sleep 30` # (wait a little bit for the operators to start installing - just wait 30 seconds or so for OLM to start installing things)
4. `hack/istio/sail/install-ossm-release.sh -c kubectl install-istio`
5. `hack/istio/install-bookinfo-demo.sh -tg -c kubectl -ail istio.io/rev=default-v1-23-0`
6. `hack/kiali-port-forward.sh`
7. Point your browser to Kiali UI at http://localhost:20001/kiali/console

Notice the auto injection label for bookinfo namespace is set to `istio.io/rev=default-v1-23-0`

## Uninstall

To uninstall, use the `delete-istio` and `delete-operators` commands to the `./install-ossm-release.sh` script.
