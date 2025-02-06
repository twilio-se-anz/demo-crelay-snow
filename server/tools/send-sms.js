/**
 * Send SMS function. This is an example of a NON-CR type tool. It should not have any CR specific messages sent back via CR.
 * 
 */
const { logOut, logError } = require('../utils/logger');
const { TwilioService } = require('../services/twilioService');

module.exports = async function (functionArguments) {
    logOut('SendSMS', `Send SMS function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    // Send the SMS
    const result = await twilioService.sendSMS(functionArguments.to, functionArguments.message);
    let response = '';

    if (!result) {
        logError('SendSMS', `Failed to send SMS to ${functionArguments.to}`);
        response = `SMS send failed to the number`;
    }

    response = `SMS sent to the number successfully to ${functionArguments.to}`;
    logOut('SendSMS', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);
    return response;
}
