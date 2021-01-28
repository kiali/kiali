#!/usr/bin/env bash

set -u

# Prints the decoded signing key from the default secret in the default Istio control plane namespace
echo_kiali_signing_key() {
  local client_exe=""
  if which kubectl > /dev/null 2>&1; then
    client_exe="kubectl";
  else
    if which oc > /dev/null 2>&1; then
      client_exe="oc";
    else
      echo "You need either 'kubectl' or 'oc' in your PATH, or define the secret key via --key option."
      exit 1
    fi
  fi
  $client_exe get secret kiali-signing-key -n istio-system -o jsonpath='{.data.key}' | base64 -d
}

#
# JWT Encoder Bash Script
#
# Use this to build a JWT token which can then be passed to the Kiali API. This is used to validate the security
# mechanisms within Kiali that do not allow for Kiali to accept hacked JWT tokens.
#

secret="${KEY:-$(echo_kiali_signing_key)}"
cookie="${COOKIE:-kiali-token}"
ncookie="${NCOOKIE:-kiali-token-openid-nonce}"

# Kiali issuers: kiali-openshift, kiali-token, kiali-open-id
iss="${ISS:-kiali-open-id}"

# When the session expires in epoch seconds - by default, expire it next Saturday
exp="${EXP:-$(date --date 'next Sat' '+%s')}"

# Session ID
sid="${SID:-}"

# Subject
sub="${SUB:-admin@example.com}"

# Nonce Code - e.g. l8LEwQHzQa0U&q0
nonce="${NONCE:-}"

# URL is left undefined - only when defined will a request be made
#url=http://192.168.99.100/kiali/api/namespaces

# process command line args
while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--cookie)
      cookie="$2"
      shift;shift
      ;;
    -e|--expires)
      exp="$2"
      shift;shift
      ;;
    -i|--issuer)
      iss="$2"
      shift;shift
      ;;
    -k|--key)
      secret="$2"
      shift;shift
      ;;
    -n|--nonce)
      nonce="$2"
      shift;shift
      ;;
    -nc|--nonce-cookie)
      ncookie="$2"
      shift;shift
      ;;
    -sid|--sessionid)
      sid="$2"
      shift;shift
      ;;
    -sub|--subject)
      sub="$2"
      shift;shift
      ;;
    -u|--url)
      url="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--cookie <cookie name>: If -u is used, this is the name of the cookie whose value is the JWT token. Default: ${cookie}
  -e|--expires <epoch secs>: Expiration date of the JWT token. Default: ${exp}
  -i|--issuer <issuer>: The issuer ("iss") to be used in the JWT payload. Default: ${iss}
  -k|--key <signing key string>: The key used to encrypt the JWT token. Default: ${secret}
  -n|--nonce <code>: If -u is used, this is the nonce code Default: ${nonce}
  -nc|--nonce-cookie <cookie name>: If -u is used, this is the name of the nonce cookie. Default: ${ncookie}
  -sid|--sessionid <id>: The long session ID text.
  -sub|--subject <name>: The subject name. Default: ${sub}
  -u|--url <url>: if specified, this script will make a curl command to this URL passing the JWT token to it.
  -h|--help : This message.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

header='{
	"alg": "HS256",
	"typ": "JWT"
}'

payload="{"
if [ ! -z ${exp} ]; then payload="${payload} ${comma:-}\"exp\": ${exp}"; comma=", "; fi
if [ ! -z ${iss} ]; then payload="${payload} ${comma:-}\"iss\": \"${iss}\""; comma=", "; fi
if [ ! -z ${sid} ]; then payload="${payload} ${comma:-}\"sid\": \"${sid}\""; comma=", "; fi
if [ ! -z ${sub} ]; then payload="${payload} ${comma:-}\"sub\": \"${sub}\""; comma=", "; fi
payload="${payload} }"

# Use jq to set the dynamic `iat` field on the header using the current time.
# This is not used - the env var being check is never true (unless the caller sets it)
if [ "${SET_IAT_IN_HEADER:-}" == "true" ]; then
header=$(
	echo "${header}" | jq --arg time_str "$(date +%s)" \
	'
	($time_str | tonumber) as $time_num
	| .iat=$time_num
	'
)
fi

base64_encode()
{
	declare input=${1:-$(</dev/stdin)}
	# Use `tr` to URL encode the output from base64.
	printf '%s' "${input}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'
}

json() {
	declare input=${1:-$(</dev/stdin)}
	printf '%s' "${input}" | jq -c .
}

hmacsha256_sign()
{
	declare input=${1:-$(</dev/stdin)}
	printf '%s' "${input}" | openssl dgst -binary -sha256 -hmac "${secret}"
}

header_base64=$(echo "${header}" | json | base64_encode)
payload_base64=$(echo "${payload}" | json | base64_encode)

header_payload=$(echo "${header_base64}.${payload_base64}")
signature=$(echo "${header_payload}" | hmacsha256_sign | base64_encode)

jwt_token="${header_payload}.${signature}"
echo "${jwt_token}"

if [ ! -z "${url:-}" ]; then
  echo "=================SUBMITING REQUEST:"
  echo "URL:     ${url}"
  echo "SECRET:  ${secret}"
  echo "COOKIE:  ${cookie}"
  echo "NCOOKIE: ${ncookie}"
  echo "ISSUER:  ${iss}"
  echo "EXPIRES: ${exp}"
  echo "SUBJECT: ${sub}"
  echo "NONCE:   ${nonce}"
  echo "SID:     ${sid}"
  echo "=================FULL JWT JSON:"
  echo -n ${jwt_token} | $(cd "$(dirname "$0")" ; pwd -P)/jwt-decode.sh -k "${secret}"
  echo "=================RESULTS:"
  if [ ! -z "${nonce}" ]; then nonce_cookie_arg="; ${ncookie}=${nonce}"; fi
  curl -v -k --cookie "${cookie}=${jwt_token}${nonce_cookie_arg:-}" ${url}
fi
