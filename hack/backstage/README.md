# Backstage and Kiali plugin

This guide walks you through setting up a full local environment with Minikube, Istio, the Bookinfo demo app, Kiali, and Backstage with the Kiali plugin installed. Perfect for testing and exploration.

## Install Kubernetes

First, spin up a local Kubernetes cluster using Minikube.

```bash
./hack/k8s-minikube start
```

## Install Istio and Bookinfo

Next, install Istio along with its sample application, Bookinfo.


```bash
./hack/istio/install-istio-via-istioctl.sh -c kubectl
./hack/istio/install-bookinfo-demo.sh -c kubectl -tg
```

## Install Kiali

Once Istio and Bookinfo are up, you can deploy Kiali to visualize your service mesh.

```bash
make clean build build-ui cluster-push operator-create kiali-create
```

## Install Backstage

Now create a fresh Backstage app that will host the Kiali plugin.

```bash
npx @backstage/create-app backstage-kiali
```

## Install and configure Kiali plugin

With Backstage created, install the Kiali plugin and configure it to point to your local Kiali instance.

```bash
./hack/backstage/install-kiali-plugin.sh -b ./backstage-kiali -u http://localhost:20001/kiali/
```

## Run Backstage

```bash
yarn start
```
