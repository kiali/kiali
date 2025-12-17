# AI Store KEP

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#nongoals)
3. [Solution](#solution)
4. [Technical Challenges](#technical-challenges)
   1. [Session Management](#session-management)
   2. [Memory Management](#memory-management)
5. [Proposed Implementation](#proposed-implementation)
   1. [Architecture](#architecture)
   2. [Per-Session Conversation Storage](#per-session-conversation-storage)
   3. [Configuration](#configuration)
   4. [Memory Estimation](#memory-estimation)
6. [Future Considerations](#future-considerations)

# Summary

Implement a conversation store for Kiali's AI Chat feature that maintains chat history across requests within a user session. The store provides session-isolated conversation management with memory-bounded storage and LRU eviction to prevent unbounded memory growth.

# Motivation

Kiali's AI Chat feature allows users to interact with AI models to troubleshoot and understand their service mesh. Each conversation requires maintaining context across multiple request/response exchanges. Without a persistent store:

- Users would lose conversation context on each request
- AI responses would lack awareness of previous messages in the conversation
- Multi-turn conversations would be impossible
- Context-aware troubleshooting workflows would fail

The AI Store addresses these needs by providing:

- Session-scoped conversation persistence
- Memory-bounded storage with automatic eviction
- Thread-safe concurrent access for multiple users
- Inactivity-based cleanup for resource efficiency

## Goals

- Maintain conversation history within user sessions for contextual AI interactions
- Prevent unbounded memory growth through configurable limits and LRU eviction
- Support multiple concurrent conversations per session
- Provide thread-safe operations for multi-user environments

## Non-goals

- Persisting conversations across Kiali restarts (conversations are ephemeral)
- Sharing conversations between different user sessions
- Storing conversations in external databases

# Solution

The AI Store uses a **per-session, in-memory conversation store** with LRU eviction. This approach:

1. **Isolates conversations by session**: Each user session maintains independent conversations
2. **Bounds memory usage**: Configurable memory limits with automatic LRU eviction
3. **Supports multiple conversations**: Users can have multiple named conversations per session
4. **Provides thread-safety**: Proper mutex locking for concurrent access

# Technical Challenges

## Session Management

Conversations must be isolated per user session to:

- Prevent data leakage between users
- Allow concurrent users without interference
- Enable proper cleanup when sessions become inactive

The store uses a two-level hierarchy:
- **Session level**: Keyed by `sessionID`, groups all conversations for a user
- **Conversation level**: Keyed by `conversationID`, individual conversation threads

## Memory Management

AI conversations can grow large, especially with:
- Long troubleshooting sessions
- Multiple back-and-forth exchanges
- Detailed responses from AI models

Without memory bounds, the store could consume excessive memory. The implementation addresses this through:

1. **Memory estimation**: Each conversation's memory footprint is estimated based on message content length
2. **Configurable limits**: Administrators set maximum cache memory via configuration
3. **LRU eviction**: When limits are approached, least-recently-accessed conversations are evicted
4. **Per-conversation tracking**: Individual conversations track their own memory usage

# Proposed Implementation

## Architecture

The AI Store implementation uses a custom in-memory store with the following key design decisions:

### Why an In-Memory Store?

1. **Ephemeral by Design**: AI conversations are session-scoped and don't need to survive restarts
2. **Low Latency**: Direct memory access provides fast retrieval for responsive AI interactions
3. **Simple Lifecycle**: No external dependencies or persistence layers to manage
4. **Session Isolation**: Natural fit for per-session data without shared state concerns

### Why Not Use the KialiCache?

Similar to the Graph Cache rationale, the existing KialiCache doesn't fit the AI Store model:

| Aspect                 | KialiCache                    | AI Store Needs                  |
| ---------------------- | ----------------------------- | ------------------------------- |
| **Permission model**   | Kiali SA token → filter after | Per-session isolation           |
| **Lifecycle**          | Singleton, process-lifetime   | Per-session, ephemeral          |
| **Key structure**      | cluster/namespace/token       | sessionID/conversationID        |
| **Eviction strategy**  | Simple TTL                    | LRU + memory limit              |
| **Data structure**     | Typed K8s objects             | OpenAI message arrays           |
| **Memory tracking**    | None                          | Per-conversation estimation     |

### Why Not a Kubernetes Controller?

1. **Non-Kubernetes Data**: Conversations are user-generated chat messages, not K8s objects
2. **No Watch Triggers**: There are no K8s resources that would trigger conversation updates
3. **Session Scoped**: Data is user-specific, not cluster-wide
4. **Permission Context**: Each session should only access its own conversations

## Per-Session Conversation Storage

The store maintains a two-level map structure:

```
conversations[sessionID] → AIChatConversation
    ├── Conversation[conversationID1] → Conversation (messages + metadata)
    ├── Conversation[conversationID2] → Conversation (messages + metadata)
    └── ...
```

Each conversation tracks:
- **Messages**: Array of `ChatCompletionMessage` objects (user + assistant messages)
- **LastAccessed**: Timestamp for LRU eviction decisions
- **EstimatedMB**: Memory footprint estimate

### Thread Safety

The implementation uses a hierarchical locking strategy:
- **Store-level mutex**: Protects the top-level session map
- **Session-level mutex**: Protects the conversation map within a session
- **Conversation-level mutex**: Protects individual conversation metadata

This allows concurrent access to different sessions while maintaining consistency.

## Configuration

AI Store is controlled via the `chat_ai.store_config` configuration block:

```yaml
chat_ai:
  store_config:
    enabled: true              # Default: true when AI chat is enabled
    inactivity_timeout: "60m"  # How long to keep inactive conversations
    max_cache_memory_mb: 1024  # Memory limit across all conversations
    reduce_with_ai: false      # Enable AI-based conversation summarization
    reduce_threshold: 15       # Minimum message count before reduction triggers
```

- **enabled**: Master switch for conversation storage
- **inactivity_timeout**: Conversations inactive longer than this are candidates for eviction
- **max_cache_memory_mb**: Soft limit on total memory usage; triggers LRU eviction when approached
- **reduce_with_ai**: When enabled, uses AI to summarize older conversation history to reduce memory usage
- **reduce_threshold**: Minimum number of messages in a conversation before AI-based reduction is triggered (default: 15)

## Memory Estimation

Memory usage is estimated based on message content length:

```go
func EstimateMessageMemory(message openai.ChatCompletionMessage) float64 {
    return float64(len(message.Content)) / 1024 / 1024  // Convert bytes to MB
}
```

This provides a reasonable approximation for eviction decisions. The estimate focuses on content length as the dominant memory consumer in conversations.

### LRU Eviction Process

When projected memory exceeds the configured limit:

1. **Sort conversations** by `LastAccessed` timestamp (oldest first)
2. **Evict oldest conversations** until sufficient memory is freed
3. **Log eviction events** for debugging and monitoring
4. **Update memory tracking** to reflect freed space

```go
func (s *AIStoreImpl) evictLRUConversations(targetMB float64) {
    // Sort all conversations across all sessions by last access time
    // Evict oldest until targetMB is freed
}
```

## AI-Based Conversation Reduction

When `reduce_with_ai` is enabled, the store can intelligently compress long conversations using AI summarization. This allows conversations to grow beyond the threshold while maintaining context and reducing memory footprint.

### Reduction Algorithm

The reduction process works as follows:

1. **Threshold Check**: Reduction only occurs when a conversation exceeds `reduce_threshold` messages (default: 15)

2. **Message Segmentation**: The conversation is divided into three parts:
   - **Instructions**: System messages (typically the first 1-2 messages containing SystemInstruction and Kiali context)
   - **To Summarize**: Middle portion of the conversation (older dialogue)
   - **Recent Messages**: Last 4 messages (latest user prompt, tool calls, and assistant response)

3. **AI Summarization**: The middle portion is sent to the AI model with instructions to create a concise technical summary that preserves:
   - Key findings (pod names, error codes, metrics)
   - Troubleshooting steps taken
   - Tool outputs and results
   - User intents and context

4. **Reconstruction**: The reduced conversation is rebuilt as:
   ```
   [Instructions] + [Summary Message] + [Recent Messages]
   ```

### Benefits

- **Memory Efficiency**: Long conversations can be maintained without proportional memory growth
- **Context Preservation**: Important technical details are preserved in the summary
- **Continuity**: Recent conversation context remains intact for ongoing troubleshooting
- **Automatic**: Reduction happens transparently during conversation storage

### Configuration

- **reduce_with_ai**: Set to `true` to enable AI-based reduction (default: `false`)
- **reduce_threshold**: Minimum message count before reduction triggers (default: `15`)

### Failure Handling

If AI summarization fails (e.g., API error, timeout), the original conversation is preserved unchanged. This ensures no data loss during the reduction process.

# Future Considerations

## Metrics and Observability

Consider adding Prometheus metrics for:
- Number of active sessions/conversations
- Memory usage trends
- Eviction rates
- Conversation lengths

These would help administrators tune configuration and monitor system health.

