import { logOut, logError } from '../utils/logger.js';

/**
 * This is a CR specific tool type. It CR specific messages sent back via the Websocket.
 * 
 * @param {*} functionArguments 
 * @returns 
 */
export default function (functionArguments) {
    logOut('SendDTMF', `Send dtmf function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response = {
        toolType: "crelay",
        toolData: {
            type: "sendDigits",
            digits: functionArguments.dtmfDigit
        }
    };
    logOut('SendDTMF', `Send DTMF response: ${JSON.stringify(response, null, 4)}`);
    return response;
}
