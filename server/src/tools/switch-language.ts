import { logOut } from '../utils/logger.js';
import { SwitchLanguageMessage } from '../interfaces/ConversationRelay.js';

/**
 * Interface for the function arguments
 */
interface SwitchLanguageFunctionArguments {
    ttsLanguage?: string;
    transcriptionLanguage?: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simple response for conversation
 */
interface SwitchLanguageResponse {
    success: boolean;
    message: string;
    ttsLanguage?: string;
    transcriptionLanguage?: string;
    outgoingMessage?: SwitchLanguageMessage;
}

/**
 * Switches TTS and/or transcription language via WebSocket
 * 
 * @param functionArguments - The arguments for the switch language function
 * @returns Simple response for conversation context with outgoing message for WebSocket routing
 */
export default function (functionArguments: SwitchLanguageFunctionArguments): SwitchLanguageResponse {
    logOut('SwitchLanguage', `Switch language function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Validate that at least one language parameter is provided
    if (!functionArguments.ttsLanguage && !functionArguments.transcriptionLanguage) {
        const errorResponse: SwitchLanguageResponse = {
            success: false,
            message: 'At least one language parameter (ttsLanguage or transcriptionLanguage) must be provided'
        };
        logOut('SwitchLanguage', `Switch language validation failed: ${JSON.stringify(errorResponse)}`);
        return errorResponse;
    }

    // Return response with both conversation context and outgoing message
    const response: SwitchLanguageResponse = {
        success: true,
        message: `Language switched successfully`,
        ttsLanguage: functionArguments.ttsLanguage,
        transcriptionLanguage: functionArguments.transcriptionLanguage,
        outgoingMessage: {
            type: "language",
            ttsLanguage: functionArguments.ttsLanguage,
            transcriptionLanguage: functionArguments.transcriptionLanguage
        }
    };

    logOut('SwitchLanguage', `Switch language response: ${JSON.stringify(response)}`);
    return response;
}