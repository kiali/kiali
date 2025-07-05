# Kiali Enhancement Proposal

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#non-goals)
3. [Solution](#solution)
   1. [UI Changes](#ui-changes)
   2. [Limitations](#limitations)
   3. [Other solutions](#other-solutions)
4. [Roadmap](#roadmap)

# Summary

Add support for handling multiple login sessions. Having a login session per cluster would allow users without centralized authentication to use Kiali across multiple clusters.

# Motivation

When a user logs into Kiali what they can see and do is restricted, depending on the authentication strategy, to what that they can access inside the Kubernetes cluster. During the authentication process for most authentication stratgies, the Kiali backend is sent the user's actual Kubernetes API token. Kiali then saves the Kubernetes API token inside of an encrypted cookie in the user's browser. The browser subsequently sends this cookie to the backend on further requests and the backend can then decrypt the cookie and use it to make requests to the Kubernetes API server on behalf of the user. This is a single login session.

With some exceptions, the user's API token is only used 1. to get the list of namespaces the user has access to and 2. for all write operations. Almost all read operations in the Kiali backend are done using a different token: Kiali's Service Account token. The Kubernetes cache inside Kiali uses Kiali's Service Account token(s) to list/watch all Kubernetes resources that Kiali consumes (`deployments`, `virtualservices`, `pods`, etc.). The Kiali backend performs access checks by caching the list of namespaces the user has access to and then checking the requested resources' namespace against that list and either filtering the results or failing the request.

Kiali has five different [authentication strategies](https://kiali.io/docs/configuration/authentication/). For multi-cluster deployments, Kiali initially had support for only the `anonymous` and `openid` authentication strategies. `anonymous` is supported since this simply uses the underlying Kiali Service Accounts for write operations and skips all access checks. `openid` is supported because it allows Kiali to use a single Kubernetes API token across clusters. This kept the login flow the same since users would only need to login once and the Kiali backend could use the same token across clusters. Other authentication strategies like `openshift` and `token` do not support re-using Kubernetes API tokens across clusters. For these strategies, the user must login to each cluster individually and the Kiali backend must save the Kubernetes API token for each cluster.

## Goals

- Allow users to login to multiple clusters in environments where clusters cannot share Kube API tokens (openshift)
- Allow for more auth strategies that support multi-cluster
- Keep current access model

## Non-goals

- Design a new access model for Kiali

# Solution

Kiali will handle a login session per cluster. Each login session will be stored in a separate cookie that has the cluster name appended on the end: `kiali-token-<ClusterName>`. If present, the "chunks" and "nonce" cookies will also have cluster name appended to the end: `kiali-token-chunks-<ClusterName>` and `kiali-token-nonce-<ClusterName>`. When the Kiali server receives a request, it will check for any cookie with the prefix of `kiali-token` and use the cluster name to map the cookie session to the kube cluster. For example, given a request with a `kiali-token-east` cookie and a `kiali-token-west` cookie, Kiali will use the `kiali-token-east` cookie when communicating with the `east` cluster's Kubernetes API and Kiali will use the `kiali-token-west` cookie when communicating with the `west` cluster.

Since login is performed per cluster, Kiali will need separate auth callback endpoints per cluster for the `openid` and `openshift` auth strategies. In a typical OAuth login flow, when the `kiali-token` session cookie is not present, the user is redirected to the OAuth server with the callback URL back to the Kiali server embedded inside the redirect URL so that after the user logs into the OAuth server, the OAuth server redirects the user back to the callback URL. When the Kiali server receives a request on the callback endpoint from the OAuth server, the Kiali server needs to know which cluster the user was logging in to. By including the cluster name in the callback URL, the Kiali server can know which cluster the user is logging in to and then use the nonce matching that cluster. For example:

```
1. Visit Kiali without session cookie
   user --> Kiali server
2. Redirected to OAuth server of the "east" cluster.
   user <-302 to OAuth server with callback- Kiali server
3. Login to OAuth server
   user --> OAuth server
3. OAuth server redirects to callback URL included in URL
   user <-302 to /kiali/auth/callback/east- OAuth server
4. Kiali checks the code received from the OAuth server against the "east" cluster's nonce
5. Kiali exchanges the code for a token with the "east" OAuth server
6. Kiali redirects the user back to the Kiali root with the `kiali-token-east` cookie that has the encrypted token
   user <-302 to /kiali with set-cookie="kiali-token-east"- Kiali server
```

With this, users can perform an OAuth login to each cluster individually.

When logging out, the Kiali server will similarly check for any cookies with the `kiali-token` prefix and unset them. Individual logout endpoints can be added in the future but this is not necessary right now. A single `/logout` endpoint will clear all Kiali session cookies from the browser.

For the `openshift` auth strategy, Kiali will autodiscover the OAuth server for every cluster through the `<Kube-API-URL>/.well-known/oauth-authorization-server` endpoint. Using this, Kiali can create an `OAuthConfig` that can be used to authenticate to that cluster's OAuth server.

## UI Changes

1. Login per cluster. Users need a way to login to each cluster. They also need to know which clusters they are currently logged in to. When a user is not logged into any cluster, there will be a cluster selection screen that lets users pick which cluster to initially login to. After the user successfully logs into the cluster, they will see the Kiali UI filtered to that individual cluster. To login to other clusters from inside the Kiali UI, users will click a dropdown in the user profile, see a list of clusters the user is already logged in to as well as clusters the user is not logged in to. When the user clicks a cluster, the Kiali backend will create a nonce cookie for that cluster, then redirect the user to the correct OAuth server.
2. Session timeout per session. The UI detects when the session token is about to expire and displays a pop-up model prompting the user to login again. This will need to be done per session now. In addition, when a session token expires, the UI will not logout the user entirely until all session tokens expire.

## Limitations

The largest limitation of this approach is header size limits. Cookies are sent/received through HTTP headers and some servers place limits on the total HTTP header size. Tokens from some OAuth providers can be large enough to exceed the HTTP header size limit for some server/proxies. Even though Kiali can chunk a large token into multiple cookies, the total HTTP header size can easily be exceeded with a multiple large cookies. Adding multiple cookies per cluster will only make this problem worse. A solution for this is to provide a different session store. Saving the encrypted session cookies to disk and having sticky sessions or using a datastore like Redis to store sessions are some possible solutions for this problem but neither are part of this proposal.

## Other solutions

- Custom RBAC roles for Kiali. Kiali could define custom RBAC roles that cover things like "listing workloads", "editing services", "view the mesh page" etc. that do not use the Kubernetes API to perform access checks directly. In this way, the user would only need to login to a single OAuth server and custom roles/scopes would define what the user could access.

# Roadmap

- [x] Multi-session login for openshift: https://github.com/kiali/kiali/issues/6360
- [x] Token per cluster: https://github.com/kiali/kiali/issues/6037
- [ ] Cluster picker login page
- [ ] Session timeout per session
- [ ] Multi-session login for openid auth
- [ ] Multi-session login for token auth
