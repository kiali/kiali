# TODO: Use same dependencies as the frontend

yarn install

# baseUrl default baseurl localhost:3000
## Can be updated in cypress.config.js or:

yarn cypress run --config baseUrl=http://mybaseurl

## Update url parameters:

fixtures/graphParams.json

# Run tests:
## yarn cypress run
## yarn cypress open

# Results:
logs/performance.txt