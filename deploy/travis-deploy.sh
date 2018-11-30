# This script is used to deploy a snapshot of Kiali
# when a Travis build is triggered in the master branch

export COMMIT_HASH=${TRAVIS_COMMIT}
export DOCKER_VERSION=$(if [ "$TRAVIS_BRANCH" == "master" ]; then echo "latest"; else echo $TRAVIS_BRANCH ; fi)
export DOCKER_USER=$(if [ "$DOCKER_USER" == "" ]; then echo "unknown"; else echo $DOCKER_USER ; fi)
export DOCKER_PASS=$(if [ "$DOCKER_PASS" == "" ]; then echo "unknown"; else echo $DOCKER_PASS ; fi)

echo DOCKER_VERSION=$DOCKER_VERSION
docker login -u "$DOCKER_USER" -p "$DOCKER_PASS"
make docker-build
docker push kiali/kiali
