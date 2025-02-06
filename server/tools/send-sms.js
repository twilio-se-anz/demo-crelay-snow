const { logOut, logError } = require('../utils/logger');
const { TwilioService } = require('../services/twilioService');

module.exports = async function (functionArguments) {
    logOut('SendSMS', `Send SMS function called with arguments: ${JSON.stringify(functionArguments)}`);

    const twilioService = new TwilioService();

    logOut('SendSMS', `Sending SMS to: ${functionArguments.to} with message: ${functionArguments.message}`);

    // Send the SMS
    const result = await twilioService.sendSMS(functionArguments.to, functionArguments.message);

    logOut('SendSMS', `SMS sent to with result: ${result}`);

    let response = '';

    if (!result) {
        logError('SendSMS', `Failed to send SMS to ${functionArguments.to}`);
        response = `SMS send failed to the number`;
    }

    response = `SMS sent to the number successfully to ${functionArguments.to}`;
    logOut('LLM', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);

    return response;
}
