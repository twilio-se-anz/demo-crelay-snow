/**
 * Create ServiceNow Ticket function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { ServiceNowService } from '../services/ServiceNowService.js';

/**
 * Interface for the function arguments
 */
interface CreateServiceNowTicketArguments {
    short_description: string;
    description?: string;
    category?: string;
    subcategory?: string;
    priority?: string;
    caller_id?: string;
    assignment_group?: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface CreateServiceNowTicketResponse {
    success: boolean;
    message: string;
    ticket_number?: string;
    ticket_id?: string;
}

/**
 * Creates a new ServiceNow incident ticket using the ServiceNow service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the create ticket function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: CreateServiceNowTicketArguments): Promise<CreateServiceNowTicketResponse> {
    const log = (msg: string) => logOut('CreateServiceNowTicket', msg);
    const logError_ = (msg: string) => logError('CreateServiceNowTicket', msg);

    log(`Create ServiceNow ticket function called with arguments: ${JSON.stringify(functionArguments)}`);

    const serviceNowService = new ServiceNowService();

    try {
        // Create the ticket
        const result = await serviceNowService.createTicket(functionArguments);

        if (!result) {
            logError_(`Failed to create ServiceNow ticket`);
            return {
                success: false,
                message: `Failed to create ServiceNow ticket`
            };
        }

        const response: CreateServiceNowTicketResponse = {
            success: true,
            message: `Ticket created successfully`,
            ticket_number: result.result.number,
            ticket_id: result.result.sys_id
        };

        log(`Ticket created successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Ticket creation failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}