#!/usr/bin/env bash

#
# JWT Decoder Bash Script
#
# To run, pipe the JWT encoded token (found in the Kiali cookie) like this:
#   echo -n $MY_JWT_TOKEN | ./jwt-decode.sh
#

secret='kiali'

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -k|--key)
      secret="$2"
      shift;shift
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

base64_encode()
{
	declare input=${1:-$(</dev/stdin)}
	# Use `tr` to URL encode the output from base64.
	printf '%s' "${input}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'
}

base64_decode()
{
	declare input=${1:-$(</dev/stdin)}
	# A standard base64 string should always be `n % 4 == 0`. We made the base64
	# string URL safe when we created the JWT, which meant removing the `=`
	# signs that are there for padding. Now we must add them back to get the
	# proper length.
	remainder=$((${#input} % 4));
	if [ $remainder -eq 1 ];
	then
		>2& echo "fatal error. base64 string is unexepcted length"
	elif [[ $remainder -eq 2 || $remainder -eq 3 ]];
	then
		input="${input}$(for i in `seq $((4 - $remainder))`; do printf =; done)"
	fi
	printf '%s' "${input}" | base64 --decode
}

verify_signature()
{
	declare header_and_payload=${1}
	expected=$(echo "${header_and_payload}" | hmacsha256_encode | base64_encode)
	actual=${2}

	if [ "${expected}" = "${actual}" ]
	then
		echo "Signature is valid"
	else
		echo "Signature is NOT valid"
	fi
}

hmacsha256_encode()
{
	declare input=${1:-$(</dev/stdin)}
	printf '%s' "${input}" | openssl dgst -binary -sha256 -hmac "${secret}"
}

# Read the token from stdin
declare token=${1:-$(</dev/stdin)};

IFS='.' read -ra pieces <<< "$token"

declare header=${pieces[0]}
declare payload=${pieces[1]}
declare signature=${pieces[2]}

# the payload may have different base64 strings separated with dash characters
IFS='-' read -ra payload_pieces <<< "$payload"

echo "Header"
echo "${header}" | base64_decode | jq
echo "Payload"
for (( i=0; i<${#payload_pieces[@]}; i++ ));
do
  if [ "$i" -gt "0" ]; then
    payload_decoded="${payload_decoded}~" # OpenShift OAuth access tokens want "~" character
  fi
  payload_decoded="${payload_decoded}$(echo -n "${payload_pieces[$i]}" | base64_decode)"
done
echo "${payload_decoded}" | jq

verify_signature "${header}.${payload}" "${signature}"

