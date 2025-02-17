/**
 * Start Capture function. This is an example of a NON-CR type tool. It should not have any CR specific messages sent back via CR.
 * 
 */
const { logOut, logError } = require('../utils/logger');
const { TwilioService } = require('../services/TwilioService');

module.exports = async function (functionArguments) {
    logOut('StartCapture', `Start Capture function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    // Send the SMS
    const response = await twilioService.StartCapture(callSid);
    logOut('StartCapture', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);

}
