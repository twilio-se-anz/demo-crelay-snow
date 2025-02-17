/**
 * Capture Security Code function. This is an example of a NON-CR type tool. It should not have any CR specific messages sent back via CR.
 * 
 */
const { logOut, logError } = require('../utils/logger');
const { TwilioService } = require('../services/TwilioService');

module.exports = async function (functionArguments) {
    logOut('CaptureSecurityCode', `Capture Security Code function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    const response = await twilioService.captureSecurityCode(
        functionArguments.statusCallback,
        functionArguments.callSid,
        functionArguments.paymentSid
    );

    logOut('CaptureSecurityCode', `Capture security code response: ${JSON.stringify(response, null, 4)}`);
    return response;
}
