/**
 * Capture Expiry Date function. This is an example of a NON-CR type tool. It should not have any CR specific messages sent back via CR.
 * 
 */
const { logOut, logError } = require('../utils/logger');
const { TwilioService } = require('../services/TwilioService');

module.exports = async function (functionArguments) {
    logOut('CaptureExpiryDate', `Capture Expiry Date function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    const response = await twilioService.captureExpiryDate(
        functionArguments.statusCallback,
        functionArguments.callSid,
        functionArguments.paymentSid
    );

    logOut('CaptureExpiryDate', `Capture expiry date response: ${JSON.stringify(response, null, 4)}`);
    return response;
}
