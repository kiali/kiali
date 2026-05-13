package providers

import (
	"encoding/json"

	"github.com/kiali/kiali/ai/types"
)

func SendStreamEvent(onChunk func(chunk string), event string, data any) {
	b, err := json.Marshal(data)
	if err != nil {
		return
	}
	streamEvent := types.StreamEvent{
		Event: event,
		Data:  b,
	}
	bEvent, err := json.Marshal(streamEvent)
	if err != nil {
		return
	}
	onChunk(string(bEvent))
}

func StreamError(onChunk func(chunk string), errMsg string) {
	SendStreamEvent(onChunk, "error", map[string]string{"message": errMsg})
}
