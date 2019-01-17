DOCKER_NAME ?= gbaufake/windsock
DOCKER_TAG ?= latest


KIALI_HOSTNAME ?= 'kiali-istio-system.openshift2.jonqe.lab.eng.bos.redhat.com'
KIALI_PORT ?= '443'
KIALI_USERNAME ?= 'admin'
KIALI_PASSWORD ?= 'admin'


# See Kiali Python Client to use it properly ()
KIALI_PATH ?= '{"namespace":"bookinfo"}'
params={'namespaces': 'bookinfo', "graphType": "versionedApp", "duration": "60s"}'
KIALI_METHOD_NAME ?= 'workloadList'
KIALI_PARAMS ?= ''



INFLUX_ADDRESS ?= 'http://route-influxdb.prod.os.jonqe.lab.eng.bos.redhat.com:80'
INFLUX_USERNAME ?= 'admin'
INFLUX_PASSWORD ?= 'admin'


RATE ?= '1'
DURATION ?= '100'
NUMBER_OF_USERS ?= '5'


all: docker-build

docker-build:
	@echo Building the Kiali Test Mesh Traffic Generator Docker image
	@mkdir -p _output/docker
	@cp docker/* _output/docker
	@docker build -t ${DOCKER_NAME}:${DOCKER_TAG} _output/docker

clean:
	@echo "Cleaning any build artifacts"
	@echo "  - Removing the _output directory"
	@rm -rf _output


deploy-performance-test:
	@echo Deploying Performance Test Kiali Windsock
	ansible-playbook performance_test.yml -e kiali_hostname=${KIALI_HOSTNAME} \
	-e kiali_path=${KIALI_PATH} \
	-e kiali_port=${KIALI_PORT} \
	-e kiali_params=${KIALI_PARAMS} \
	-e kiali_username=${KIALI_USERNAME} \
	-e kiali_password=${KIALI_PASSWORD} \
	-e kiali_method_name=${KIALI_METHOD_NAME} \
	-e influx_address=${INFLUX_ADDRESS} \
	-e influx_username=${INFLUX_USERNAME} \
	-e influx_password=${INFLUX_PASSWORD} \
	-e rate=${RATE}  \
	-e duration=${DURATION} \
	-e number_of_users=${NUMBER_OF_USERS}  -vvv
