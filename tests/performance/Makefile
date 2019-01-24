DOCKER_NAME ?= gbaufake/windsock
DOCKER_TAG ?= latest


KIALI_HOSTNAME = 'kiali.hostname.com'
KIALI_USERNAME = 'admin'
KIALI_PASSWORD = 'admin'
TEST_NAME = 'graphNamespace'


# InfluxDB is needed to compile all the tests logs from different pods (it is not directly provided)
INFLUX_ADDRESS = 'influx-hostname.com'
INFLUX_USERNAME = 'admin'
INFLUX_PASSWORD = 'admin'


RATE = '1' # requests rate per second
DURATION = '0' # duration of test in seconds (0 is eternal)
NUMBER_OF_USERS = '5' # number of pods which be deployed


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
	-e kiali_username=${KIALI_USERNAME} \
	-e kiali_password=${KIALI_PASSWORD} \
	-e test_name=${TEST_NAME} \
	-e influx_address=${INFLUX_ADDRESS} \
	-e influx_username=${INFLUX_USERNAME} \
	-e influx_password=${INFLUX_PASSWORD} \
	-e rate=${RATE}  \
	-e duration=${DURATION} \
	-e number_of_users=${NUMBER_OF_USERS}  -vvv
