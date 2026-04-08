package kubernetes

// GetServiceAccountTokenCredential prefers the service account token file path over a
// static token snapshot so file-backed rotation can be picked up automatically.
func GetServiceAccountTokenCredential(client ClientInterface) string {
	if clientConfig := client.ClusterInfo().ClientConfig; clientConfig != nil && clientConfig.BearerTokenFile != "" {
		return clientConfig.BearerTokenFile
	}
	return client.GetToken()
}
