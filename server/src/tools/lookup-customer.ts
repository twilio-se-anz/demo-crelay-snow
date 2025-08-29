/**
 * Lookup Customer function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { ServiceNowService } from '../services/ServiceNowService.js';

/**
 * Interface for the function arguments
 */
interface LookupCustomerArguments {
    search_term: string;
    search_type?: string;  // 'email', 'phone', 'name', or 'username' (default: 'email')
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface LookupCustomerResponse {
    success: boolean;
    message: string;
    customers?: Array<{
        sys_id: string;
        name: string;
        email: string;
        phone: string;
        user_name: string;
        active: boolean;
    }>;
}

/**
 * Looks up customer information in ServiceNow using the ServiceNow service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the lookup customer function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: LookupCustomerArguments): Promise<LookupCustomerResponse> {
    const log = (msg: string) => logOut('LookupCustomer', msg);
    const logError_ = (msg: string) => logError('LookupCustomer', msg);

    log(`Lookup customer function called with arguments: ${JSON.stringify(functionArguments)}`);

    const serviceNowService = new ServiceNowService();

    try {
        // Lookup the customer
        const result = await serviceNowService.lookupCustomer(
            functionArguments.search_term,
            functionArguments.search_type || 'email'
        );

        if (!result || result.result.length === 0) {
            const notFoundMessage = `No customers found for: ${functionArguments.search_term}`;
            log(notFoundMessage);
            return {
                success: false,
                message: notFoundMessage
            };
        }

        const response: LookupCustomerResponse = {
            success: true,
            message: `Found ${result.result.length} customer(s)`,
            customers: result.result.map(customer => ({
                sys_id: customer.sys_id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                user_name: customer.user_name,
                active: customer.active
            }))
        };

        log(`Customer lookup successful: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Customer lookup failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}