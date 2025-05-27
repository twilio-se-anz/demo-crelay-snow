import { logOut, logError } from '../utils/logger.js';

/**
 * Interface for the function arguments
 */
interface SendDTMFFunctionArguments {
    dtmfDigit: string;
    [key: string]: any;
}

/**
 * Interface for the response object
 */
interface SendDTMFResponse {
    toolType: string;
    toolData: {
        type: string;
        digits: string;
    };
}

/**
 * This is a CR specific tool type. It CR specific messages sent back via the Websocket.
 * 
 * @param functionArguments - The arguments for the send DTMF function
 * @returns The response object for sending DTMF tones
 */
export default function (functionArguments: SendDTMFFunctionArguments): SendDTMFResponse {
    logOut('SendDTMF', `Send dtmf function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response: SendDTMFResponse = {
        toolType: "crelay",
        toolData: {
            type: "sendDigits",
            digits: functionArguments.dtmfDigit
        }
    };
    logOut('SendDTMF', `Send DTMF response: ${JSON.stringify(response, null, 4)}`);
    return response;
}
