import { logOut } from '../utils/logger.js';
import { SendDigitsMessage } from '../interfaces/ConversationRelay.js';

/**
 * Interface for the function arguments
 */
interface SendDTMFFunctionArguments {
    dtmfDigit: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simple response for conversation
 */
interface SendDTMFResponse {
    success: boolean;
    message: string;
    digits: string;
    outgoingMessage?: SendDigitsMessage;
}

/**
 * Sends DTMF digits via WebSocket and returns conversation context
 * 
 * @param functionArguments - The arguments for the send DTMF function
 * @returns Simple response for conversation context with outgoing message for WebSocket routing
 */
export default function (functionArguments: SendDTMFFunctionArguments): SendDTMFResponse {
    logOut('SendDTMF', `Send dtmf function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Return response with both conversation context and outgoing message
    const response: SendDTMFResponse = {
        success: true,
        message: `DTMF digits sent successfully`,
        digits: functionArguments.dtmfDigit,
        outgoingMessage: {
            type: "sendDigits",
            digits: functionArguments.dtmfDigit
        }
    };

    logOut('SendDTMF', `Send DTMF response: ${JSON.stringify(response)}`);
    return response;
}