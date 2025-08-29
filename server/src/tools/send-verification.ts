/**
 * Send Verification function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { TwilioService } from '../services/TwilioService.js';

/**
 * Interface for the function arguments
 */
interface SendVerificationArguments {
    to: string;
    channel?: string;  // 'sms' or 'call' (default: 'sms')
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface SendVerificationResponse {
    success: boolean;
    message: string;
    recipient?: string;
    channel?: string;
    verification_sid?: string;
}

/**
 * Sends a verification code using Twilio Verify service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the send verification function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: SendVerificationArguments): Promise<SendVerificationResponse> {
    const log = (msg: string) => logOut('SendVerification', msg);
    const logError_ = (msg: string) => logError('SendVerification', msg);

    log(`Send verification function called with arguments: ${JSON.stringify(functionArguments)}`);

    const twilioService = new TwilioService();

    try {
        const channel = functionArguments.channel || 'sms';
        
        // Send the verification
        const verificationSid = await twilioService.sendVerification(functionArguments.to, channel);

        if (!verificationSid) {
            logError_(`Failed to send verification to ${functionArguments.to} via ${channel}`);
            return {
                success: false,
                message: `Failed to send verification to ${functionArguments.to} via ${channel}`
            };
        }

        const response: SendVerificationResponse = {
            success: true,
            message: `Verification code sent successfully via ${channel}`,
            recipient: functionArguments.to,
            channel: channel,
            verification_sid: verificationSid
        };

        log(`Verification sent successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Verification send failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}