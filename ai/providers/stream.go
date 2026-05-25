package providers

import (
	"encoding/json"

	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

const (
	LLM_START_EVENT                     = "start"
	LLM_TOKEN_EVENT                     = "token"
	LLM_END_EVENT                       = "end"
	LLM_ERROR_EVENT                     = "error"
	LLM_REASONING_EVENT                 = "reasoning"
	LLM_TOOL_CALL_EVENT                 = "tool_call"
	LLM_TOOL_RESULT_EVENT               = "tool_result"
	LLM_HISTORY_COMPRESSION_START_EVENT = "history_compression_start"
	LLM_HISTORY_COMPRESSION_END_EVENT   = "history_compression_end"
)

func SendStreamEvent(onChunk func(chunk string), event string, data any) {
	b, err := json.Marshal(data)
	if err != nil {
		log.Errorf("[AI][Stream][Error] Error marshalling stream event: %v", err)
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
	SendStreamEvent(onChunk, LLM_ERROR_EVENT, map[string]string{"message": errMsg})
}
