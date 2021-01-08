package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/kubernetes"
)

type TokenReviewService struct {
	k8s kubernetes.ClientInterface
}

type AccessibleTokenReviewError struct {
	msg string
}

func (in *AccessibleTokenReviewError) Error() string {
	return in.msg
}

func NewTokenReview(k8s kubernetes.ClientInterface) TokenReviewService {

	return TokenReviewService{
		k8s: k8s,
	}

}

func (in *TokenReviewService) GetTokenSubject(authInfo *api.AuthInfo) (string, error) {
	return in.k8s.GetTokenSubject(authInfo)
}
