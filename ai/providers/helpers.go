package providers

import (
	"encoding/json"

	"github.com/kiali/kiali/ai/types"
)

func NewConversationMessage(param interface{}, role, name, content string) types.ConversationMessage {
	return types.ConversationMessage{
		Content: content,
		Name:    name,
		Param:   param,
		Role:    role,
	}
}

func FormatToolContent(result interface{}) (string, error) {
	switch v := result.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}
