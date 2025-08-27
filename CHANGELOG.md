# Changelog

## Release v4.3.0

### Tool Type-Driven Architecture Migration

#### Complete Event-Driven to Tool Type-Driven Transformation
- **Architectural Paradigm Shift**: Migrated from event-driven tool system to pure tool type-driven architecture using OutgoingMessage types
- **Enhanced Type Safety**: Replaced generic "crelay" routing with specific OutgoingMessage type-based routing (`sendDigits`, `end`, `text`, etc.)
- **Terminal Tool Timing Fix**: Implemented proper timing for terminal tools to ensure OpenAI response is delivered before call termination
- **Clean Separation of Concerns**: Eliminated all remaining event-driven concepts from tool execution and response handling

#### Tool Response Architecture Overhaul
- **OutgoingMessage Integration**: CRelay-specific tools now return proper `OutgoingMessage` types directly in their response
- **Generic vs. CRelay Tools**: Clear distinction between generic LLM tools (send-sms) and CRelay-specific tools (send-dtmf, end-call, live-agent-handoff)
- **Type-Driven Routing**: ConversationRelayService routes based on `outgoingMessage.type` instead of generic event types
- **Interface Imports**: CRelay tools import OutgoingMessage interfaces while generic tools remain dependency-free

#### Tool Response Pattern Updates
- **send-dtmf.ts**: Returns `SendDigitsMessage` type with immediate WebSocket delivery
- **end-call.ts**: Returns `EndSessionMessage` type with delayed delivery after OpenAI response
- **live-agent-handoff.ts**: Returns `EndSessionMessage` type with delayed delivery after OpenAI response  
- **send-sms.ts**: Remains generic tool with no OutgoingMessage dependencies

#### Service Architecture Clean-Up
- **OpenAIResponseService**: Completely agnostic about ConversationRelay concepts, passes all tool results generically
- **ConversationRelayService**: Contains all OutgoingMessage knowledge and routing logic based on message types
- **Terminal Message Timing**: Proper sequencing ensures user hears confirmation before call ends for terminal actions

#### Routing Logic Implementation
- **Immediate Delivery**: `sendDigits`, `play`, `language` types sent immediately to WebSocket
- **Delayed Delivery**: `end` type stored and sent after OpenAI response completion (`response.last === true`)
- **Standard Processing**: `text` type and tools without outgoingMessage processed normally by OpenAI
- **Type-Safe Switching**: Comprehensive switch statement handles all OutgoingMessage types appropriately

#### Code Cleanup and Documentation
- **Removed Event Remnants**: Eliminated all remaining references to event emission and "crelay" terminology
- **Updated Documentation**: Changed `@emits` to `@calls` throughout service documentation
- **Interface Cleanup**: Removed obsolete `crelayData` field from ToolResult interface
- **Comment Updates**: Updated all comments to reflect dependency injection patterns instead of event-driven patterns

### Benefits of Tool Type-Driven Architecture

#### Architectural Improvements
- **Pure Dependency Injection**: Complete elimination of event system in favor of direct function calls
- **Type-Safe Routing**: OutgoingMessage types provide compile-time safety for WebSocket message handling
- **Clear Tool Categories**: Explicit separation between generic LLM tools and conversation relay tools
- **Proper Timing Control**: Terminal tools now deliver responses before ending calls

#### Developer Experience
- **Better Type Safety**: OutgoingMessage interfaces provide full IntelliSense and compile-time checking
- **Cleaner Tool Development**: Clear patterns for different tool types with proper interface imports
- **Reduced Complexity**: Eliminated event system complexity in favor of straightforward return value routing
- **Enhanced Debugging**: Type-driven routing makes message flow easier to trace and debug

#### Performance & Reliability
- **Eliminated Event Overhead**: Direct function calls replace event emission for better performance
- **Proper Terminal Timing**: Users now hear confirmation messages before calls end for better UX
- **Reduced Memory Usage**: No event listener registration or cleanup overhead
- **Type Safety**: Compile-time validation prevents runtime routing errors

This migration represents the final step in moving from event-driven to pure dependency injection architecture, providing a clean, type-safe, and maintainable foundation for tool development and message routing.

## Release v4.2.1

### Unified Handler Architecture Refactoring

#### Consolidated Handler Interfaces
- **Unified ResponseHandler**: Replaced 4 individual setter methods (`setContentHandler`, `setToolResultHandler`, `setErrorHandler`, `setCallSidHandler`) with single `createResponseHandler(handler: ResponseHandler)` method
- **Unified ConversationRelayHandler**: Replaced 3 individual setter methods (`setOutgoingMessageHandler`, `setCallSidEventHandler`, `setSilenceEventHandler`) with single `createConversationRelayHandler(handler: ConversationRelayHandler)` method
- **Better Encapsulation**: Handler methods now use clean names like `content()`, `toolResult()`, `error()`, `callSid()` instead of event-style naming

#### Interface Architecture Improvements
- **ResponseHandler Interface**: Created unified interface with `content()`, `toolResult()`, `error()`, and `callSid()` methods
- **ConversationRelayHandler Interface**: Created unified interface with `outgoingMessage()`, `callSid()`, and `silence()` methods
- **Eliminated Circular Dependencies**: Removed circular dependency issues by using `createResponseHandler()` method instead of constructor injection

#### Service Implementation Updates
- **OpenAIResponseService**: Updated to use single `responseHandler` property and `createResponseHandler()` method
- **FlowiseResponseService**: Updated to use unified handler pattern for consistency
- **ConversationRelayService**: Updated to create unified handler objects and use `createConversationRelayHandler()` method
- **Server.ts Integration**: Updated WebSocket server to use unified handler objects instead of individual setter calls

#### Dependency Injection Enhancements
- **Cleaner Constructor Pattern**: Services now accept handlers through create methods rather than multiple setter calls
- **Better Type Safety**: Unified handlers provide stronger type contracts and better IntelliSense support
- **Simplified Service Setup**: Single handler object creation replaces multiple handler registration calls
- **Improved Maintainability**: Related handler methods are now grouped together in single interfaces

### Benefits of Unified Handler Architecture

#### Code Organization
- **Better Cohesion**: All related handler methods grouped in single interface objects
- **Cleaner APIs**: Single `createXxxHandler()` method instead of multiple setters eliminates setup complexity
- **Reduced Coupling**: Handler interfaces are self-contained and don't require multiple method calls

#### Developer Experience
- **Simplified Setup**: Single handler object creation replaces multiple setter method calls
- **Better Type Safety**: Unified interfaces provide comprehensive type checking for all handler methods
- **Enhanced IntelliSense**: IDE support improved with consolidated handler method definitions
- **Cleaner Dependencies**: Clear handler contracts make service relationships more transparent

#### Architectural Benefits
- **Eliminated Circular Dependencies**: `createResponseHandler()` pattern prevents construction-time circular dependency issues
- **Single Responsibility**: Each handler interface focuses on one specific communication domain
- **Better Separation of Concerns**: Clear distinction between different types of handler responsibilities
- **Future Extensibility**: Unified pattern makes it easier to add new handler methods without interface proliferation

This refactoring maintains full backward compatibility while providing a cleaner, more maintainable dependency injection architecture that eliminates multiple setter methods in favor of consolidated handler objects.

## Release v4.2.1 (Previous)

### Handler Type Organization Refactoring

#### Handler Type Relocation
- **Improved Organization**: Moved handler types from centralized `handlers.ts` to their respective interface files for better code organization
- **Enhanced Cohesion**: Handler types are now co-located with the interfaces they support, improving maintainability and discoverability
- **Cleaner Dependencies**: Reduced coupling between interface files by eliminating the central handler types dependency

#### File Structure Changes
- **Removed**: `server/src/types/handlers.ts` - Centralized handler types file eliminated
- **Enhanced**: `server/src/interfaces/ResponseService.d.ts` - Now includes `ContentHandler`, `ToolResultHandler`, and `ErrorHandler` types
- **Enhanced**: `server/src/interfaces/ConversationRelay.d.ts` - Now includes `OutgoingMessageHandler`, `CallSidEventHandler`, and `SilenceEventHandler` types
- **Updated**: All import statements updated to reference handler types from their respective interface files

#### Interface Method Updates
- **Type Safety Enhancement**: Updated interface method signatures to use proper type names instead of inline function types
- **Consistency Improvement**: All service implementations now use strongly-typed handler parameters consistently
- **Better IntelliSense**: Improved IDE support with proper type definitions co-located with interface documentation

#### Import Statement Updates
- **ConversationRelayService**: Updated to import handler types from `../interfaces/ConversationRelay.js`
- **OpenAIResponseService**: Updated to import handler types from `../interfaces/ResponseService.js`  
- **FlowiseResponseService**: Updated to import handler types from `../interfaces/ResponseService.js`
- **Eliminated Unused Imports**: Removed unnecessary import of `ToolResultEvent` in FlowiseResponseService

### Benefits of Handler Type Reorganization

#### Code Organization
- **Better Cohesion**: Handler types are now located next to the interfaces they support
- **Improved Discoverability**: Developers can find all related types and interfaces in a single file
- **Cleaner Architecture**: Eliminates the need for a centralized types file that creates unnecessary dependencies

#### Maintainability
- **Easier Updates**: Changes to handler signatures can be made alongside interface updates
- **Better Documentation**: Handler types benefit from proximity to interface documentation
- **Reduced Coupling**: Interface files are now self-contained with their associated types

#### Developer Experience
- **Enhanced IntelliSense**: IDE can provide better autocomplete and documentation when types and interfaces are co-located
- **Cleaner Imports**: Developers import both interfaces and their handler types from the same location
- **Better Code Navigation**: Related types and interfaces are in the same file for easier navigation

This refactoring maintains full backward compatibility while providing better code organization and improved developer experience through enhanced type locality and reduced coupling between interface files.

## Release v4.2.0

### Dependency Injection Architecture Migration

#### Complete Event-Driven to Dependency Injection Transformation
- **Architectural Paradigm Shift**: Migrated from EventEmitter-based communication to Dependency Injection pattern across all service layers
- **Enhanced Type Safety**: Replaced magic string events with strongly-typed handler functions for compile-time validation
- **Performance Optimization**: Eliminated EventEmitter overhead with direct function calls for faster service communication
- **Improved Testability**: Handler functions enable easier mocking, stubbing, and unit testing compared to event-based testing

#### ResponseService Interface DI Implementation
- **Handler Function Architecture**: Replaced EventEmitter inheritance with handler setter methods:
  - `setContentHandler(handler: ContentHandler): void` - For LLM streaming responses
  - `setToolResultHandler(handler: ToolResultHandler): void` - For tool execution results  
  - `setErrorHandler(handler: ErrorHandler): void` - For error event handling
  - `setCallSidHandler(handler: CallSidEventHandler): void` - For call-specific events
- **Service Implementations**: Updated OpenAIResponseService and FlowiseResponseService to use handler pattern
- **Type-Safe Communication**: Direct handler invocation with `this.contentHandler?.(response)` instead of `this.emit('responseService.content', response)`

#### ConversationRelayService DI Enhancement
- **Handler Integration**: Added support for ResponseService handlers through dependency injection
- **Outgoing Message Management**: Implemented `setOutgoingMessageHandler()` for WebSocket message transmission
- **Silence Event Handling**: Added `setSilenceEventHandler()` for silence detection and call termination events
- **Event Elimination**: Removed all `this.emit()` calls in favor of direct handler invocations

#### Server.ts WebSocket Integration
- **Selective DI Adoption**: Converted ConversationRelayService events to handlers while preserving WebSocket server events
- **Handler Registration**: Replaced `conversationRelaySession.on('conversationRelay.outgoingMessage', ...)` with `conversationRelaySession.setOutgoingMessageHandler(...)`
- **Call SID Event Handling**: Updated dynamic call-specific events to use static handlers with callSid parameters
- **Preserved WebSocket Architecture**: Maintained `ws.on('message')`, `ws.on('close')`, `ws.on('error')` event-driven pattern

#### Type System Enhancements
- **Handler Type Definitions**: Created comprehensive handler type system in `handlers.ts`:
  ```typescript
  export type ContentHandler = (response: ContentResponse) => void;
  export type ToolResultHandler = (toolResult: ToolResultEvent) => void;
  export type ErrorHandler = (error: Error) => void;
  export type CallSidEventHandler = (callSid: string, responseMessage: any) => void;
  export type OutgoingMessageHandler = (message: OutgoingMessage) => void;
  export type SilenceEventHandler = (message: OutgoingMessage) => void;
  ```
- **Interface Updates**: Enhanced ResponseService and ConversationRelay interfaces with handler setter methods
- **Type Safety**: Proper type conversion from `ContentResponse` to `OutgoingMessage` for cross-service communication

#### Resource Management
- **Handler Cleanup**: Implemented proper handler cleanup in service destructors to prevent memory leaks
- **Optional Chaining**: Used `?.()` operator for safe handler invocation when handlers may not be set
- **Service Lifecycle**: Enhanced cleanup methods to clear all handlers and prevent resource leaks

### Benefits of Dependency Injection Architecture

#### Performance Improvements
- **Direct Function Calls**: Eliminated EventEmitter dispatch overhead for faster service communication
- **Reduced Memory Footprint**: No event listener registration and cleanup overhead
- **Optimized Call Stack**: Direct handler invocation without event system intermediation

#### Type Safety & Developer Experience  
- **Compile-Time Validation**: TypeScript enforces correct handler signatures and prevents runtime errors
- **IntelliSense Support**: Full IDE autocompletion and documentation for handler functions
- **Elimination of Magic Strings**: No more `'responseService.content'` strings that can break silently

#### Testing & Maintainability
- **Easier Mocking**: Handler functions are simple to mock compared to complex event listener testing
- **Unit Test Isolation**: Individual handlers can be tested independently without event system complexity
- **Cleaner Dependencies**: Clear handler contracts make service dependencies explicit and manageable

#### Architectural Benefits
- **Single Responsibility**: Each handler focuses on one specific communication channel
- **Interface Segregation**: Services only implement handlers they actually need
- **Dependency Inversion**: Services depend on handler abstractions, not concrete implementations
- **Better Separation of Concerns**: Clear distinction between service logic and communication mechanisms

This migration represents a fundamental architectural improvement providing better performance, type safety, and maintainability while maintaining full functional compatibility with existing WebSocket and HTTP endpoints.

## Release v4.1.2

### Interface Method Splitting

#### ResponseService Interface Enhancement
- **Method Separation**: Split `updateContextAndManifest(contextFile: string, toolManifestFile: string)` into two separate methods:
  - `updateContext(contextFile: string): Promise<void>` - Updates only the context file
  - `updateTools(toolManifestFile: string): Promise<void>` - Updates only the tool manifest file
- **Better Separation of Concerns**: Each method now has a single, clear responsibility
- **Granular Control**: Applications can now update context or tools independently as needed

#### ConversationRelay Interface Enhancement
- **Consistent API**: Applied the same method splitting to the ConversationRelay interface
- **Interface Alignment**: Both ResponseService and ConversationRelay interfaces now have matching method signatures
- **Type Safety**: Updated interface declarations in both interface and class definitions

#### Implementation Updates
- **OpenAIResponseService**: Split the complex `updateContextAndManifest()` implementation into:
  - `updateContext()` - Handles context file loading, instruction updates, and conversation reset
  - `updateTools()` - Handles tool manifest loading and dynamic tool reloading
- **FlowiseResponseService**: Updated stub implementation with separate methods
- **ConversationRelayService**: Replaced single proxy method with two separate proxy methods
- **Server.ts**: Updated call site to use both methods sequentially

#### Factory Method Updates
- **OpenAIResponseService.create()**: Now calls both `updateContext()` and `updateTools()` separately
- **FlowiseResponseService.create()**: Updated to use the new method signatures
- **Backward Compatibility**: All existing functionality is preserved

### Benefits
- **Single Responsibility Principle**: Each method focuses on one specific update operation
- **Improved Flexibility**: Context and tools can be updated independently
- **Better Code Organization**: Clearer separation between context and tool management
- **Enhanced Maintainability**: Easier to test and modify individual components
- **Consistent API Design**: Uniform method signatures across all service interfaces

This refactoring maintains full backward compatibility while providing more granular control over service configuration updates.

## Release v4.1.1

### Service Naming Refactoring

#### OpenAI Service Renaming
- **Service Clarity**: Renamed `OpenAIService` to `OpenAIResponseService` for better clarity and consistency
- **File Renaming**: Updated `OpenAIService.ts` to `OpenAIResponseService.ts` in the services directory
- **Import Updates**: Updated all import statements throughout the codebase to reference the new service name
- **Class References**: Updated all class instantiations and references from `OpenAIService` to `OpenAIResponseService`
- **Logging Updates**: Updated all logging messages to use the new service name for consistency

#### Documentation Updates
- **README.md**: Updated service references and project structure documentation to reflect the new naming
- **CHANGELOG.md**: Added comprehensive release notes for the renaming refactoring
- **Version Bump**: Updated package.json version to 4.1.1

### Benefits
- **Improved Clarity**: The new name better reflects the service's role as a response service implementation
- **Consistent Naming**: Aligns with the service architecture patterns established in previous releases
- **Better Code Readability**: More descriptive class names improve code understanding
- **Maintainability**: Consistent naming conventions across the codebase

This refactoring maintains full backward compatibility while improving code clarity and consistency with established naming patterns.

## Release v4.1.0

### Service Architecture Refactoring

#### ConversationRelayService Enhancement
- **Enhanced Encapsulation**: Moved all OpenAI service creation and management into ConversationRelayService
- **Async Factory Pattern**: Added static `create()` factory method for proper async initialization of ConversationRelayService
- **Proxy Methods**: Added `insertMessage()` and `updateContextAndManifest()` proxy methods for clean API access
- **Event Management**: Improved event forwarding from `responseService.${callSid}` to `conversationRelay.${callSid}`

#### Server.ts Simplification
- **Removed Direct OpenAI Service Creation**: Eliminated lines 146-151 and 155-160 from server.ts 
- **Updated WSSession Interface**: Removed `sessionResponseService` dependency from WebSocket sessions
- **Cleaner Architecture**: Server.ts now focuses purely on WebSocket/HTTP handling without LLM service management
- **Method Migration**: All `sessionResponseService` calls now use `conversationRelaySession` proxy methods
- **Variable Naming Consistency**: Renamed `sessionConversationRelay` to `conversationRelaySession` throughout server.ts for consistent naming conventions

#### Interface Updates
- **Enhanced ResponseService Interface**: Added `updateContextAndManifest()` method to the interface definition
- **Type Safety**: Improved type checking with proper role parameter types for `insertMessage()`
- **Event Consistency**: Standardized event naming from `responseService.${callSid}` to `conversationRelay.${callSid}`

#### Outgoing Message Interface Enforcement
- **Added Twilio Outgoing Message Interfaces**: Implemented comprehensive TypeScript interfaces for all Twilio WebSocket outgoing message types based on official documentation
- **Enhanced Type Safety**: Added `OutgoingMessage` union type covering `TextTokensMessage`, `PlayMediaMessage`, `SendDigitsMessage`, `SwitchLanguageMessage`, and `EndSessionMessage`
- **Method Signature Updates**: Updated `outgoingMessage()` method to accept structured `OutgoingMessage` types instead of generic strings
- **Separation of Concerns**: Clear distinction between `outgoingMessage()` for Twilio commands and `insertMessage()` for conversation context
- **Removed Any Types**: Replaced `any` type annotations with proper `OutgoingMessage` types in WebSocket event handlers

#### Interface Naming Refactoring
- **Resolved Naming Conflicts**: Renamed `ConversationRelayService.d.ts` to `ConversationRelay.d.ts` to eliminate naming conflicts between interface and class
- **Interface Renaming**: Updated interface name from `ConversationRelayService` to `ConversationRelay` for better separation
- **Import Updates**: Updated all import statements to use the new file name and removed unnecessary aliasing (`as IConversationRelayService`)
- **Type Safety Improvements**: Eliminated TypeScript compilation errors caused by naming conflicts

### Benefits
- **Single Responsibility**: ConversationRelayService now manages all LLM service interactions
- **Improved Maintainability**: Clear separation between WebSocket handling and conversation management
- **Better Encapsulation**: All OpenAI service logic contained within a single service class
- **Consistent API**: Uniform access to response service functionality through proxy methods
- **Enhanced Type Safety**: Comprehensive TypeScript interfaces ensure compile-time validation of all Twilio WebSocket messages
- **Better Developer Experience**: IntelliSense support and type checking for all outgoing message structures
- **Cleaner Interface Separation**: Clear distinction between interface definitions and class implementations

This refactoring provides better code organization and maintainability while maintaining full backward compatibility.

## Release v4.0.1

### Bug Fixes

#### Fixed Duplicate Function Call Error
- **Issue**: OpenAI Response API was rejecting requests with "400 Duplicate item found" error after tool execution
- **Root Cause**: The `store: true` parameter caused conflicts between Response API's internal state management and manual `inputMessages` management
- **Solution**: Removed `store: true` and `previous_response_id` from all Response API calls, letting manual conversation state management handle everything
- **Impact**: Tool calls (like SMS) now work correctly with multiple interruptions and follow-up responses

#### Technical Details
- Response API with `store: true` maintains conversation state internally
- Manual function call management in `inputMessages` conflicted with API's stored state
- Removing conversation storage eliminated both "duplicate item" and "no tool output" errors
- System now uses traditional accumulative `inputMessages` approach without API storage conflicts

This fix ensures reliable tool execution in conversation flows with multiple user interactions and interruptions.

## Release v4.0.0

This release introduces a major architectural refactor that fundamentally changes how LLM services are implemented and managed, moving from inheritance-based to interface-based architecture while fixing critical design issues.

### 🚨 Breaking Changes

#### Interface-Based Architecture (Composition over Inheritance)
- **Removed**: `ResponseService.ts` base class - the inheritance-based approach has been completely removed
- **Added**: `ResponseService.d.ts` interface defining the contract for all LLM service implementations
- **Changed**: OpenAIService now implements the ResponseService interface instead of extending a base class
- **Benefits**: Better TypeScript support, cleaner separation of concerns, easier testing and mocking

#### Factory Pattern for Async Initialization
- **Fixed**: Invalid async constructor pattern in OpenAIService
- **Changed**: Constructor is now private and synchronous-only
- **Added**: Static `create()` factory method for proper async initialization
- **Migration**: Replace `new OpenAIService(contextFile, toolManifestFile)` with `await OpenAIService.create(contextFile, toolManifestFile)`

#### Service Removal
- **Removed**: Complete removal of DeepSeek service support
- **Simplified**: System now focuses exclusively on OpenAI integration
- **Environment**: DEEPSEEK_API_KEY and DEEPSEEK_MODEL environment variables are no longer used

#### API Standardization
- **Changed**: Method `insertMessageIntoContext()` renamed to `insertMessage()` for consistency with interface
- **Standardized**: All ResponseService implementations now follow the same method signatures
- **Improved**: Better error handling and type safety across all service methods

### Technical Improvements

#### Enhanced Type Safety
- **Interface Contracts**: All LLM services must implement the ResponseService interface
- **Type Definitions**: Comprehensive TypeScript interfaces for ContentResponse, ToolResult, and ToolResultEvent
- **Event Standardization**: Consistent event emission patterns across all services

#### Import Structure Updates
- **Interface Imports**: Updated from concrete class imports to interface definitions
- **Path Updates**: ConversationRelayService now imports from `../interfaces/ResponseService.js`
- **Cleaner Dependencies**: Better separation between interfaces and implementations

### Migration Guide

#### For OpenAIService Usage:
```typescript
// Before (v3.x)
const service = new OpenAIService(contextFile, toolManifestFile);

// After (v4.0)
const service = await OpenAIService.create(contextFile, toolManifestFile);
```

#### For Custom LLM Providers:
```typescript
// Before (v3.x)
class CustomService extends ResponseService {
  constructor() {
    super();
    // initialization
  }
}

// After (v4.0) - Note: v4.2.0 removes EventEmitter inheritance for pure DI
class CustomService extends EventEmitter implements ResponseService {
  private constructor() {
    super();
    // sync initialization only
  }
  
  static async create(): Promise<CustomService> {
    const service = new CustomService();
    await service.initialize();
    return service;
  }
  
  // Implement all ResponseService interface methods
  async generateResponse(role: 'user' | 'system', prompt: string): Promise<void> { ... }
  async insertMessage(role: 'system' | 'user' | 'assistant', message: string): Promise<void> { ... }
  interrupt(): void { ... }
  cleanup(): void { ... }
}
```

#### For Method Name Updates:
```typescript
// Before (v3.x)
await responseService.insertMessageIntoContext('system', message);

// After (v4.0)
await responseService.insertMessage('system', message);
```

### Architecture Benefits

- **Composition over Inheritance**: More flexible and maintainable design pattern
- **Interface Segregation**: Clear contracts for service implementations
- **Dependency Inversion**: Depend on interfaces, not concrete implementations
- **Better Testing**: Easier to mock and test service interactions
- **Type Safety**: Compile-time checking of service method implementations

This release represents a fundamental improvement in the codebase architecture, providing better maintainability, type safety, and extensibility while removing deprecated service providers.

## Release v3.3.1

### Development & Documentation Updates

- **Updated Development Script**: Changed from `tsc && nodemon` to `tsx watch src/server.ts` for faster development cycles
- **OpenAI Version Upgrade**: Updated OpenAI package version in package.json
- **AbortController Documentation**: Added technical comparison section in README explaining AbortController vs. boolean flag approaches for interrupt handling

## Release v3.3

This release enhances type safety and API alignment by migrating from custom streaming event interfaces to OpenAI's native typed streaming events, providing better maintainability and future-proofing.

### Migration to OpenAI Native Streaming Events

The system has been updated to use OpenAI's native `ResponseStreamEvent` types instead of custom `ResponseAPIEvent` interfaces, bringing several key benefits:

- **Enhanced Type Safety**: Full TypeScript support with OpenAI's official event types
- **Better API Alignment**: Direct use of OpenAI's streaming event specifications
- **Improved Maintainability**: Reduced custom code in favor of official SDK types
- **Future-Proof Architecture**: Automatic compatibility with OpenAI's evolving streaming API

### Key Changes

- **Native Event Types**: Replaced custom `ResponsesAPIEvent` interface with OpenAI's `ResponseStreamEvent` union type
- **Proper Event Handling**: Updated event processing to use correct OpenAI event names (e.g., `response.completed` instead of `response.done`)
- **Type-Safe Streaming**: Full TypeScript support for all streaming events including `ResponseCreatedEvent`, `ResponseTextDeltaEvent`, `ResponseCompletedEvent`, etc.
- **Enhanced Error Detection**: Better error handling through properly typed event structures

### Technical Details

The migration involved:
- Importing `ResponseStreamEvent` from `openai/resources/responses/responses.mjs`
- Removing the custom `ResponsesAPIEvent` interface
- Updating event type checking to use OpenAI's official event type names
- Ensuring proper type safety throughout the streaming pipeline

### Benefits

- **Reduced Maintenance**: No need to maintain custom event interfaces that duplicate OpenAI's functionality
- **Better Documentation**: Direct access to OpenAI's official type documentation
- **Automatic Updates**: Future OpenAI SDK updates will automatically provide new event types
- **Type Safety**: Compile-time checking ensures correct event handling

This change aligns the codebase with OpenAI's official streaming API documentation and provides better long-term maintainability while maintaining full backward compatibility.

## Release v3.2

This release introduces a significant architectural improvement with the migration from the toolType-based system to a ToolEvent-based system, providing enhanced flexibility and cleaner separation of concerns for tool execution.

### Migration to ToolEvent System

The system has been updated to use a ToolEvent-based architecture instead of the previous toolType system, bringing several key benefits:

- **Enhanced Tool Isolation**: Tools now receive a ToolEvent object that provides controlled access to emit events, logging, and error handling
- **Improved Event Management**: Clear separation between tool execution and event emission through the ToolEvent interface
- **Better Error Handling**: Tools can now emit errors and log messages through the ToolEvent system
- **Cleaner Architecture**: Removal of complex toolType switching logic in favor of event-driven communication

### Key Changes

- **ToolEvent Interface**: Tools now receive a ToolEvent object with `emit()`, `log()`, and `logError()` methods
- **Event-Driven Communication**: Tools emit events using `toolEvent.emit(eventType, data)` instead of returning toolType objects
- **Simplified Tool Logic**: Tools focus on their core functionality while delegating communication to the ToolEvent system
- **Enhanced Logging**: Built-in logging capabilities through the ToolEvent interface

### Technical Improvements

- **ResponseService Enhancement**: The `createToolEvent()` method provides tools with a controlled interface for event emission
- **Event Processing**: Tools emit events that are processed by the ResponseService and forwarded to ConversationRelayService
- **Backward Compatibility**: The system maintains compatibility while providing a more robust foundation for tool development
- **Type Safety**: Enhanced TypeScript interfaces for ToolEvent and tool responses

### Tool Implementation Changes

Tools now follow this pattern:

```typescript
export default function (functionArguments: ToolArguments, toolEvent?: ToolEvent): ToolResponse {
    // Tool logic here
    
    if (toolEvent) {
        // Emit events for WebSocket transmission
        toolEvent.emit('crelay', {
            type: "action",
            data: actionData
        });
        toolEvent.log(`Action completed: ${JSON.stringify(actionData)}`);
    }
    
    // Return simple response for conversation context
    return {
        success: true,
        message: "Action completed successfully"
    };
}
```

This migration provides a more maintainable and extensible architecture for tool development while maintaining full backward compatibility.

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
