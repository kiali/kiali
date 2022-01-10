# Tools for Kiali maintainers

This folder contains tools for maintainers of the Kiali project.

## Mock graph data

There's two cli tools to help with testing large graph topologies without needing to deploy the underlying resources.

**Note:** You do not need to run the generator before running the proxy. The proxy server will run the generator itself and serve up the mock data from memory by default. If you are testing locally, you probably want to use the proxy. If you want to output the mock data as a json file, then run the generator.

### proxy server

The proxy server runs an http proxy that intercepts all `/api/namespaces/graph` calls and returns mock graph data. The rest of the api calls are passed through to the kiali api. To test the kiali ui using the proxy server, you should start the proxy server then, in the kiali ui's `package.json`, replace the `proxy` field with the address of the proxy server e.g. `"proxy": "https://localhost:10201"`. Finally run `yarn start` and navigate to local node server endpoint: `http://localhost:3000`. When you navigate to the graph page, you should see graph rendered with the mock data.

Running the following command will start the proxy server in https mode.

```bash
go run tools/cmd/proxy/main.go <kiali-url> --apps 50 --box --https
```

For more usage information:

```bash
go run tools/cmd/proxy/main.go --help
```

### generator

The generator creates a json file with a mock `/api/namespaces/graph` response.

Running the following command will create a json file with 50 apps (workloads + services). There is some randomness in the graph generation so running the command multiple times with the same options will yield different results.

```bash
go run tools/cmd/generate/main.go --apps 50 --box
```

For more usage information:

```bash
go run tools/cmd/generate/main.go --help
```
