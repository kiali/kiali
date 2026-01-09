package prompts

import (
	openai "github.com/sashabaranov/go-openai"
)

// AddPromptReminders appends the action and citation prompt reminders to the conversation.
// This should be called after tool results are added and before the final API call.
func AddPromptReminders(conversation []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	// Add action prompt reminder
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: ActionPrompt,
	})

	return conversation
}

// AddActionPrompt appends only the action prompt reminder to the conversation.
func AddActionPrompt(conversation []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	return append(conversation, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: ActionPrompt,
	})
}
