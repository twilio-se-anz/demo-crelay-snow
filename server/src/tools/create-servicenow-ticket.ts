/**
 * Create ServiceNow Ticket function - creates a new incident ticket in ServiceNow
 * This tool allows the virtual assistant to create tickets for customers with proper categorization and details
 */
import { logOut, logError } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Interface for the function arguments
 */
interface CreateServiceNowTicketFunctionArguments {
  shortDescription: string;
  description: string;
  callerSysId: string; // sys_id of the caller from lookup-customer tool
  priority?: "1" | "2" | "3" | "4" | "5"; // 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning
  urgency?: "1" | "2" | "3"; // 1=High, 2=Medium, 3=Low
  category?: string;
  subcategory?: string;
  contactType?: string; // phone, email, walk-in, self-service
  workNotes?: string;
  parentCase?: string; // Optional parent incident number
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
 * Interface for ServiceNow ticket creation response
 */
interface ServiceNowTicketCreationResponse {
  sys_id: string;
  number: string;
  state: string;
  opened_at: string;
  caller_id: string;
}

/**
 * Interface for the response object
 */
interface CreateServiceNowTicketResponse {
  success: boolean;
  message: string;
  ticket?: ServiceNowTicketCreationResponse;
  ticketNumber?: string;
  ticketSysId?: string;
}

/**
 * Creates a new incident ticket in ServiceNow
 *
 * @param functionArguments - The arguments for creating the ServiceNow ticket
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object with created ticket information for conversation context
 */
export default async function (
  functionArguments: CreateServiceNowTicketFunctionArguments,
  toolEvent?: ToolEvent
): Promise<CreateServiceNowTicketResponse> {
  const log =
    toolEvent?.log || ((msg: string) => logOut("CreateServiceNowTicket", msg));
  const logError_ =
    toolEvent?.logError ||
    ((msg: string) => logError("CreateServiceNowTicket", msg));

  log(
    `Create ServiceNow ticket function called for: ${functionArguments.shortDescription}`
  );
  log(`Caller sys_id: ${functionArguments.callerSysId}`);

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

    // Use the provided caller sys_id
    const callerSysId = functionArguments.callerSysId;
    log(`Using caller sys_id: ${callerSysId}`);

    // Step 1: Handle parent case lookup if provided
    let parentSysId = "";
    if (functionArguments.parentCase) {
      const parentQueryParams = new URLSearchParams({
        sysparm_query: `number=${functionArguments.parentCase}`,
        sysparm_fields: "sys_id,number",
      });

      const parentResponse = await fetch(
        `${baseUrl}/api/now/table/incident?${parentQueryParams}`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
        if (parentData.result && parentData.result.length > 0) {
          parentSysId = parentData.result[0].sys_id;
          log(
            `Found parent case: ${functionArguments.parentCase} (${parentSysId})`
          );
        } else {
          log(
            `Parent case ${functionArguments.parentCase} not found, creating ticket without parent`
          );
        }
      }
    }

    // Step 2: Create the incident ticket
    const ticketApiUrl = `${baseUrl}/api/now/table/incident`;

    const ticketData: any = {
      short_description: functionArguments.shortDescription,
      description: functionArguments.description,
      contact_type: functionArguments.contactType || "phone",
      state: "1", // New
      priority: functionArguments.priority || "3", // Default to Moderate
      urgency: functionArguments.urgency || "2", // Default to Medium
      category: functionArguments.category || "Software",
      subcategory: functionArguments.subcategory || "",
    };

    // Add caller if found
    if (callerSysId) {
      ticketData.caller_id = callerSysId;
    }

    // Add parent case if found
    if (parentSysId) {
      ticketData.parent_incident = parentSysId;
    }

    // Add work notes if provided
    if (functionArguments.workNotes) {
      ticketData.work_notes = `Initial notes from virtual assistant: ${functionArguments.workNotes}`;
    }

    const createResponse = await fetch(ticketApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(ticketData),
    });

    if (!createResponse.ok) {
      throw new Error(
        `ServiceNow ticket creation failed: ${createResponse.status} ${createResponse.statusText}`
      );
    }

    const createdTicketData = await createResponse.json();
    const createdTicket = createdTicketData.result;

    const successResponse: CreateServiceNowTicketResponse = {
      success: true,
      message: `Successfully created ticket ${createdTicket.number}`,
      ticket: {
        sys_id: createdTicket.sys_id,
        number: createdTicket.number,
        state: createdTicket.state,
        opened_at: createdTicket.opened_at,
        caller_id: createdTicket.caller_id || "",
      },
      ticketNumber: createdTicket.number,
      ticketSysId: createdTicket.sys_id,
    };

    log(
      `ServiceNow ticket created successfully: ${createdTicket.number} (${createdTicket.sys_id})`
    );
    return successResponse;
  } catch (error) {
    const errorMessage = `ServiceNow ticket creation failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logError_(errorMessage);

    return {
      success: false,
      message: errorMessage,
    };
  }
}
