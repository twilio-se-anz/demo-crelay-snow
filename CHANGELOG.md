# Changelog

## Release v3.1

This release introduces a significant architectural improvement with the migration from OpenAI's ChatCompletion API to the Response API, providing enhanced flexibility and future-proofing for LLM integrations.

### Migration to Response API

The system has been updated to use OpenAI's Response API instead of the ChatCompletion API, bringing several key benefits:

- **Enhanced Robustness**: The Response API provides more reliable streaming capabilities and better error handling
- **Improved Flexibility**: Support for additional response formats and processing options  
- **Future-Proof Architecture**: Better alignment with OpenAI's evolving API ecosystem
- **Multi-Provider Support**: Foundation for easier integration of additional LLM providers beyond OpenAI

### Key Changes

- **ResponseService Architecture**: The OpenAIService has been enhanced with a new ResponseService base class that abstracts LLM interactions
- **Unified Interface**: All LLM providers now implement a consistent interface through the ResponseService pattern
- **Enhanced Error Handling**: Improved error detection and recovery mechanisms
- **Streaming Optimization**: Better handling of streaming responses with interrupt capabilities

### Technical Improvements

- Migrated from ChatCompletion API to Response API for all OpenAI interactions
- Implemented ResponseService base class for consistent LLM provider abstraction
- Enhanced streaming response handling with improved interrupt capabilities
- Improved error handling and recovery mechanisms across all LLM interactions
- Maintained full backward compatibility while providing foundation for future enhancements

This migration maintains full backward compatibility while providing a more robust foundation for future enhancements and multi-provider LLM support.

## Release v3.0

- Converted the entire project from JavaScript to TypeScript
- Added type definitions for all components
- Implemented interfaces for data structures
- Added return type declarations
- Enhanced JSDoc comments with TypeScript-specific documentation
- Added tsconfig.json for TypeScript configuration

## Release v2.4

NOTE: - Updated the Voices in the TwilioService.ts file to reflect What is available now as of March 2025. New 11Labs voices are coming soon.

This release introduces a structured tool response system to improve tool integration and response handling:

### Enhanced Tool Response Architecture
- Implemented a standardized response format with `toolType` and `toolData` properties
- Created a type-based routing system for different kinds of tool responses
- Added support for four distinct response types: "tool", "crelay", "error", and "llm"
- Improved separation between conversation flow and direct actions

This architecture enables more flexible tool integration by clearly defining how each tool's response should be processed:
- Standard tools return results to the LLM for conversational responses
- Conversation Relay tools bypass the LLM for direct WebSocket communication
- Error responses are handled gracefully within the conversation context
- Future extensibility is built in with the reserved "llm" type

The new system improves reliability, reduces complexity, and creates a clear separation of concerns between different types of tool operations.

## Release v2.3

This release adds interrupt handling capabilities to improve the conversational experience:

### Interrupt Handling
- Added support for handling user interruptions during AI responses
- Implemented interrupt detection and processing in ConversationRelayService
- Added interrupt() and resetInterrupt() methods to ResponseService for controlling response streaming
- Enhanced streaming response generation to check for interruptions and stop gracefully
- Improved user experience by allowing natural conversation flow with interruptions

When a user interrupts the AI during a response:
1. The system detects the interruption and sends an 'interrupt' message with the partial utterance
2. ConversationRelayService processes this message and calls responseService.interrupt()
3. ResponseService sets an isInterrupted flag that stops the current streaming response
4. The system can then process the user's new input immediately

The interrupt mechanism works by:
- Setting the isInterrupted flag to true in the ResponseService
- Breaking out of the streaming loop in generateResponse
- Allowing the system to process the new user input
- Automatically resetting the interrupt flag at the beginning of each new response generation

This feature enables more natural conversations by allowing users to interrupt lengthy responses, correct misunderstandings immediately, or redirect the conversation without waiting for the AI to finish speaking.

## Release v2.2

This release adds the ability to dynamically update conversation contexts and tool manifests during an active call:

### Dynamic Context & Manifest Updates
- Added new `/updateResponseService` endpoint to change conversation context and tool manifest files during active calls
- Enables real-time switching between different conversation scenarios without ending the call
- Supports seamless transitions between different AI behaviors and tool sets

#### Using the Update Endpoint

To update the context and manifest files for an active call, send a POST request to the `/updateResponseService` endpoint:

```bash
curl -X POST \
  'https://your-server-url/updateResponseService' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "callSid": "CA1234...",           # The active call's SID
    "contextFile": "MyContext.md",     # New context file to load
    "toolManifestFile": "MyToolManifest.json"  # New tool manifest to load
  }'
```

This allows you to:
- Switch conversation contexts mid-call
- Update available tools based on conversation flow
- Adapt AI behavior for different phases of the call
- Maintain call continuity while changing conversation parameters

## Release v2.1

This release brings significant enhancements to the conversation relay system:

### Dynamic Context & Manifest Loading
- Implemented a flexible context loading system that allows switching conversation contexts and tool sets at runtime
- Added support for multiple context files (e.g., defaultContext.md, MyContext.md) to handle different use cases
- Enhanced tool manifest system with dynamic loading capabilities, allowing tools to be loaded based on context
- Environment variables (LLM_CONTEXT, LLM_MANIFEST) now control which context and tools are loaded
- Improved separation of concerns by isolating different conversation scenarios with their own contexts

### Added DeepSeek Response Service
- Integrated DeepSeek as an alternative LLM provider alongside OpenAI
- Implemented DeepSeekService extending the base ResponseService for consistent behavior
- Added configuration support through DEEPSEEK_API_KEY and DEEPSEEK_MODEL environment variables
- Maintains full compatibility with existing tool execution and conversation management features
- Enables easy switching between LLM providers through service configuration

### Added Twilio Status Callback Endpoint
- New `/twilioStatusCallback` endpoint for handling Twilio event notifications
- Real-time status updates are now propagated to the conversation context
- Implemented event-based system to route callbacks to appropriate conversation sessions
- Status updates are automatically inserted into conversation context for LLM awareness
- Enhanced call monitoring and state management through Twilio's callback system
