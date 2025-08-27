import { logOut } from '../utils/logger.js';

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
    crelayData?: {
        type: "sendDigits";
        digits: string;
    };
}

/**
 * Sends DTMF digits via WebSocket and returns conversation context
 * 
 * @param functionArguments - The arguments for the send DTMF function
 * @returns Simple response for conversation context with crelay data for WebSocket routing
 */
export default function (functionArguments: SendDTMFFunctionArguments): SendDTMFResponse {
    logOut('SendDTMF', `Send dtmf function called with arguments: ${JSON.stringify(functionArguments)}`);

    const dtmfData = {
        type: "sendDigits" as const,
        digits: functionArguments.dtmfDigit
    };

    // Return response with both conversation context and crelay data
    const response: SendDTMFResponse = {
        success: true,
        message: `DTMF digits sent successfully`,
        digits: functionArguments.dtmfDigit,
        crelayData: dtmfData
    };

    logOut('SendDTMF', `Send DTMF response: ${JSON.stringify(response)}`);
    return response;
}