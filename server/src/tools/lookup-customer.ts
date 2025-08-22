/**
 * Lookup Customer function - finds customer information and open tickets in ServiceNow by phone number
 * This tool provides proactive customer identification and context for personalized service
 */
import { logOut, logError } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Interface for the function arguments
 */
interface LookupCustomerFunctionArguments {
  phoneNumber: string;
  [key: string]: any;
}

/**
 * Interface for the tool event (passed by ResponseService)
 */
interface ToolEvent {
  emit: (eventType: string, data: any) => void;
  log: (message: string) => void;
  logError: (message: string) => void;
}

/**
 * Interface for ServiceNow user data
 */
interface ServiceNowUser {
  sys_id: string;
  name: string;
  email: string;
  phone: string;
  mobile_phone?: string;
  company: string;
  department: string;
  title: string;
  location: string;
  user_name: string;
  active: boolean;
}

/**
 * Interface for ServiceNow ticket summary
 */
interface ServiceNowTicketSummary {
  number: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
  assigned_to: string;
  assignment_group: string;
  sys_id: string;
}

/**
 * Interface for the response object
 */
interface LookupCustomerResponse {
  success: boolean;
  message: string;
  customer?: ServiceNowUser;
  openTickets?: ServiceNowTicketSummary[];
  ticketCount?: number;
}

/**
 * Looks up customer information and open tickets in ServiceNow by phone number
 *
 * @param functionArguments - The arguments for the lookup customer function
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object with customer and ticket information for conversation context
 */
export default async function (
  functionArguments: LookupCustomerFunctionArguments,
  toolEvent?: ToolEvent
): Promise<LookupCustomerResponse> {
  const log =
    toolEvent?.log || ((msg: string) => logOut("LookupCustomer", msg));
  const logError_ =
    toolEvent?.logError || ((msg: string) => logError("LookupCustomer", msg));

  log(
    `Lookup customer function called with phone number: ${functionArguments.phoneNumber}`
  );

  // Get ServiceNow credentials from environment
  const serviceNowInstance = process.env.SERVICENOW_INSTANCE;
  const serviceNowUsername = process.env.SERVICENOW_USERNAME;
  const serviceNowPassword = process.env.SERVICENOW_PASSWORD;

  log(`ServiceNow Instance: ${serviceNowInstance ? "SET" : "NOT SET"}`);
  log(`ServiceNow Username: ${serviceNowUsername ? "SET" : "NOT SET"}`);
  log(`ServiceNow Password: ${serviceNowPassword ? "SET" : "NOT SET"}`);

  if (!serviceNowInstance || !serviceNowUsername || !serviceNowPassword) {
    const errorMessage =
      "Missing required ServiceNow credentials in environment variables";
    logError_(errorMessage);
    return {
      success: false,
      message: errorMessage,
    };
  }

  try {
    // Normalize ServiceNow instance URL
    let baseUrl = serviceNowInstance;
    if (baseUrl.startsWith("https://")) {
      // Instance is already a full URL, use as-is
      baseUrl = baseUrl;
    } else {
      // Instance is just the name, construct full URL
      baseUrl = `https://${baseUrl}.service-now.com`;
    }

    // Create authorization header (Basic Auth)
    const auth = Buffer.from(
      `${serviceNowUsername}:${serviceNowPassword}`
    ).toString("base64");

    // Normalize phone number for search (remove common formatting including plus sign)
    const normalizedPhone = functionArguments.phoneNumber.replace(
      /[\s\-\(\)\.\+]/g,
      ""
    );
    log(`Normalized phone number for search: ${normalizedPhone}`);

    // Step 1: Find user by mobile phone number only
    const userApiUrl = `${baseUrl}/api/now/table/sys_user`;
    const userQueryParams = new URLSearchParams({
      sysparm_query: `mobile_phone=${normalizedPhone}^ORphone=${normalizedPhone}^active=true`,
      sysparm_fields:
        "sys_id,name,email,phone,mobile_phone,company.name,department.name,title,location.name,user_name,active",
    });

    const fullUserUrl = `${userApiUrl}?${userQueryParams}`;
    log(`User lookup URL: ${fullUserUrl}`);

    const userResponse = await fetch(fullUserUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    log(
      `User API Response Status: ${userResponse.status} ${userResponse.statusText}`
    );

    if (!userResponse.ok) {
      throw new Error(
        `ServiceNow User API request failed: ${userResponse.status} ${userResponse.statusText}`
      );
    }

    const userData = await userResponse.json();
    // log(`User API Response: ${JSON.stringify(userData, null, 2)}`);

    if (!userData.result || userData.result.length === 0) {
      const notFoundMessage = `No customer found with phone number ${functionArguments.phoneNumber}`;
      log(notFoundMessage);
      return {
        success: false,
        message: notFoundMessage,
      };
    }

    log(`Found ${userData.result.length} matching user(s)`);

    // Get the first matching user
    const userRecord = userData.result[0];

    const customer: ServiceNowUser = {
      sys_id: userRecord.sys_id,
      name: userRecord.name || "",
      email: userRecord.email || "",
      phone: userRecord.phone || "",
      mobile_phone: userRecord.mobile_phone || "",
      company: userRecord.company?.name || "",
      department: userRecord.department?.name || "",
      title: userRecord.title || "",
      location: userRecord.location?.name || "",
      user_name: userRecord.user_name || "",
      active: userRecord.active || false,
    };

    // Step 2: Find open tickets for this customer
    const ticketApiUrl = `${baseUrl}/api/now/table/incident`;
    const ticketQueryParams = new URLSearchParams({
      sysparm_query: `caller_id=${customer.sys_id}^state!=6^state!=7^state!=8`, // Exclude Resolved, Closed, Canceled
      sysparm_fields:
        "number,short_description,state,priority,opened_at,assigned_to.name,assignment_group.name,sys_id",
      sysparm_order_by: "opened_at",
    });

    const ticketResponse = await fetch(`${ticketApiUrl}?${ticketQueryParams}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!ticketResponse.ok) {
      throw new Error(
        `ServiceNow Ticket API request failed: ${ticketResponse.status} ${ticketResponse.statusText}`
      );
    }

    const ticketData = await ticketResponse.json();

    // Map state numbers to readable status
    const stateMapping: { [key: string]: string } = {
      "1": "New",
      "2": "In Progress",
      "3": "On Hold",
      "6": "Resolved",
      "7": "Closed",
      "8": "Canceled",
    };

    // Map priority numbers to readable priority
    const priorityMapping: { [key: string]: string } = {
      "1": "Critical",
      "2": "High",
      "3": "Moderate",
      "4": "Low",
      "5": "Planning",
    };

    const openTickets: ServiceNowTicketSummary[] = ticketData.result.map(
      (ticket: any) => ({
        number: ticket.number,
        short_description: ticket.short_description || "",
        state: stateMapping[ticket.state] || ticket.state,
        priority: priorityMapping[ticket.priority] || ticket.priority,
        opened_at: ticket.opened_at,
        assigned_to: ticket.assigned_to?.name || "Unassigned",
        assignment_group: ticket.assignment_group?.name || "Unassigned",
        sys_id: ticket.sys_id,
      })
    );

    const successResponse: LookupCustomerResponse = {
      success: true,
      message: `Customer found: ${customer.name} with ${openTickets.length} open tickets`,
      customer: customer,
      openTickets: openTickets,
      ticketCount: openTickets.length,
    };

    log(
      `Customer lookup successful for ${customer.name} (${customer.email}) with ${openTickets.length} open tickets`
    );
    return successResponse;
  } catch (error) {
    const errorMessage = `Customer lookup failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logError_(errorMessage);

    return {
      success: false,
      message: errorMessage,
    };
  }
}
