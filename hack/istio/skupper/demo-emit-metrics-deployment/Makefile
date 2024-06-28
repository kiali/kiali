DORP = podman
IMAGE_NAME = demo-extension-metrics-server:latest
QUAY_IMAGE_NAME = quay.io/kiali/${IMAGE_NAME}
DEMO_NAMESPACE ?= extension-metrics-demo

build:
	${DORP} build -t ${QUAY_IMAGE_NAME} .

# This will allow you to run the script locally. This is just to test that the script works and so you can
# confirm the metrics defined in the ConfigMap yaml are what you want them to be. Just access the endpoint
# via curl http://localhost:9090 and look at the metrics that are returned.
run:
	@echo "Extracing metrics.txt from ConfigMap from k8s.yaml and storing to /tmp/metrics.txt"
	@cat ./k8s.yaml | sed -n '/^  metrics.txt: |/,$$p' | sed -e 's/^  metrics.txt: |//' -e 's/^  //' | sed '/^$$/d' | sed 's/^[[:space:]]*//' > /tmp/metrics.txt
	@echo "Starting metric server. To access, run 'curl http://localhost:9090'"
	${DORP} run -it --rm -p 9090:9090 -v /tmp/metrics.txt:/tmp/metrics.txt:z ${QUAY_IMAGE_NAME}

# Builds and pushes a new image to quay. You only need to do this if you change the script itself or the Dockerfile.
# You do not need to build or push the image if you are only changing the Deployment yaml or the metrics in the ConfigMap yaml.
push-quay: build
	${DORP} push ${QUAY_IMAGE_NAME}

# Deploy the demo app to any namespace you choose. The namespace is defined in the env var DEMO_NAMESPACE.
deploy:
	kubectl get namespace ${DEMO_NAMESPACE} &> /dev/null || kubectl create namespace ${DEMO_NAMESPACE}
	kubectl apply -f ./k8s.yaml -n ${DEMO_NAMESPACE}

# Undeploy the demo app. The namespace where the app is expected to be is defined in the env var DEMO_NAMESPACE.
undeploy:
	kubectl delete --ignore-not-found=true -f ./k8s.yaml -n ${DEMO_NAMESPACE}

# After changing the k8s.yaml (e.g. the metrics in the ConfigMap), this will redeploy everything and restart the pod.
redeploy: deploy
	kubectl rollout restart deployment -l app=demo-extension-metrics-server -n ${DEMO_NAMESPACE}
