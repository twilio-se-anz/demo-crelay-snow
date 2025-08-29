/**
 * Check Verification function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { TwilioService } from '../services/TwilioService.js';

/**
 * Interface for the function arguments
 */
interface CheckVerificationArguments {
    to: string;
    code: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface CheckVerificationResponse {
    success: boolean;
    message: string;
    verified?: boolean;
    recipient?: string;
}

/**
 * Checks a verification code using Twilio Verify service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the check verification function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: CheckVerificationArguments): Promise<CheckVerificationResponse> {
    const log = (msg: string) => logOut('CheckVerification', msg);
    const logError_ = (msg: string) => logError('CheckVerification', msg);

    log(`Check verification function called with arguments: ${JSON.stringify(functionArguments)}`);

    const twilioService = new TwilioService();

    try {
        // Check the verification code
        const isVerified = await twilioService.checkVerification(functionArguments.to, functionArguments.code);

        const response: CheckVerificationResponse = {
            success: true,
            message: isVerified ? 'Verification code is valid' : 'Verification code is invalid or expired',
            verified: isVerified,
            recipient: functionArguments.to
        };

        log(`Verification check completed: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Verification check failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage,
            verified: false
        };
    }
}