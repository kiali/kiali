# Kiali Performance Tests

## Prerequisites:

- Install [frontend dependencies](../../frontend/README.adoc)

## Run tests:

From the kiali root:

cli
```
make -e CYPRESS_BASE_URL=http://mybaseurl perf-tests-run
```

gui
```
make perf-tests-gui
```

yarn from current dir
```
yarn --cwd <kiali-root>/frontend cypress --project <kiali-root>/tests/perf
```

## Update url parameters:

fixtures/graphParams.json

## Results:

logs/performance.txt
