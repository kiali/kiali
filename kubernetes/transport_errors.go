package kubernetes

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
)

// IsConnectionError reports whether the error is a network-level failure (dial, DNS, EOF)
// as opposed to an API-level response. It identifies transport failures: a cluster that
// fails this way may be unreachable, while any API-level answer (even an authorization
// error) proves the cluster is reachable. *net.DNSError and *net.OpError both implement
// net.Error and are covered by the first check.
func IsConnectionError(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	return errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}

// IsTLSError reports whether the error is a TLS handshake or certificate verification
// failure, which indicates a definitive configuration problem rather than a transient one.
func IsTLSError(err error) bool {
	var certVerificationErr *tls.CertificateVerificationError
	if errors.As(err, &certVerificationErr) {
		return true
	}
	var unknownAuthorityErr x509.UnknownAuthorityError
	if errors.As(err, &unknownAuthorityErr) {
		return true
	}
	var hostnameErr x509.HostnameError
	if errors.As(err, &hostnameErr) {
		return true
	}
	var certInvalidErr x509.CertificateInvalidError
	return errors.As(err, &certInvalidErr)
}
