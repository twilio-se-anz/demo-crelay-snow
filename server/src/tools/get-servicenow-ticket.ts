/**
 * Get ServiceNow Ticket function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { ServiceNowService } from '../services/ServiceNowService.js';

/**
 * Interface for the function arguments
 */
interface GetServiceNowTicketArguments {
    ticket_identifier: string;  // Can be ticket number (INC0000123) or sys_id
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface GetServiceNowTicketResponse {
    success: boolean;
    message: string;
    ticket?: {
        number: string;
        sys_id: string;
        state: string;
        short_description: string;
        description?: string;
        priority?: string;
        category?: string;
        subcategory?: string;
        caller_id?: string;
        assigned_to?: string;
        assignment_group?: string;
        created_on: string;
        updated_on: string;
    };
}

/**
 * Retrieves a ServiceNow incident ticket using the ServiceNow service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the get ticket function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: GetServiceNowTicketArguments): Promise<GetServiceNowTicketResponse> {
    const log = (msg: string) => logOut('GetServiceNowTicket', msg);
    const logError_ = (msg: string) => logError('GetServiceNowTicket', msg);

    log(`Get ServiceNow ticket function called with arguments: ${JSON.stringify(functionArguments)}`);

    const serviceNowService = new ServiceNowService();

    try {
        // Get the ticket
        const result = await serviceNowService.getTicket(functionArguments.ticket_identifier);

        if (!result) {
            const notFoundMessage = `Ticket not found: ${functionArguments.ticket_identifier}`;
            log(notFoundMessage);
            return {
                success: false,
                message: notFoundMessage
            };
        }

        const response: GetServiceNowTicketResponse = {
            success: true,
            message: `Ticket retrieved successfully`,
            ticket: {
                number: result.result.number,
                sys_id: result.result.sys_id,
                state: result.result.state,
                short_description: result.result.short_description,
                description: result.result.description,
                priority: result.result.priority,
                category: result.result.category,
                subcategory: result.result.subcategory,
                caller_id: result.result.caller_id,
                assigned_to: result.result.assigned_to,
                assignment_group: result.result.assignment_group,
                created_on: result.result.created_on,
                updated_on: result.result.updated_on
            }
        };

        log(`Ticket retrieved successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Ticket retrieval failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}