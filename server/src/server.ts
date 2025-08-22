/**
 * Main server file that sets up Express with WebSocket support and defines API endpoints.
 * @module server
 * @requires dotenv
 * @requires express
 * @requires express-ws
 */

import dotenv from "dotenv";
import express from "express";
import expressWs, { Application as ExpressWSApplication } from "express-ws";
import { logOut, logError } from "./utils/logger.js";

// Import the services
import { ConversationRelayService } from "./services/ConversationRelayService.js";
import { OpenAIService } from "./services/OpenAIService.js";
import { DeepSeekService } from "./services/DeepSeekService.js";
import { TwilioService } from "./services/TwilioService.js";

// Define interfaces for session data
interface SessionData {
  parameterData: Record<string, any>;
  setupData: {
    callSid: string;
    from: string;
    to?: string;
    customParameters?: {
      callReference?: string;
      contextFile?: string;
      toolManifestFile?: string;
    };
    [key: string]: any;
  };
}

// Define interface for incoming message
interface IncomingMessage {
  type: "setup" | "prompt" | "dtmf" | "interrupt" | "info" | "error";
  callSid?: string;
  from?: string;
  to?: string;
  customParameters?: {
    callReference?: string;
    contextFile?: string;
    toolManifestFile?: string;
  };
  voicePrompt?: string;
  utteranceUntilInterrupt?: string;
  digit?: string;
  description?: string;
  [key: string]: any;
}

// Define interface for WebSocket session
interface WSSession {
  sessionConversationRelay: ConversationRelayService;
  sessionResponseService: OpenAIService | DeepSeekService;
  sessionData: SessionData;
}

// Define interface for request data
interface RequestData {
  callSid?: string;
  contextFile?: string;
  toolManifestFile?: string;
  properties?: {
    phoneNumber: string;
    callReference: string;
    firstname?: string;
    lastname?: string;
    [key: string]: any;
  };
}

dotenv.config();
const app = express() as unknown as ExpressWSApplication;
const PORT = process.env.PORT || 3000;
let serverBaseUrl = process.env.SERVER_BASE_URL || "localhost"; // Store server URL
const wsInstance = expressWs(app); // Initialize express-ws

app.use(express.urlencoded({ extended: true })); // For Twilio url encoded body
app.use(express.json()); // For JSON payloads

/**
 * This parameterDataMap illustrates how you would pass data via Conversation Relay Parameters.
 * The intention is to store and get data via this map per WS session
 * TODO: Can this be per WS session?
 */
let wsSessionsMap = new Map<string, WSSession>();
let parameterDataMap = new Map<string, { requestData: any }>();
const twilioService = new TwilioService();

/****************************************************
 *
 * Web Socket Endpoints
 *
 ****************************************************/

/**
 * WebSocket endpoint for real-time conversation relay.
 * Handles the lifecycle of a conversation session including setup, message processing, and cleanup.
 *
 * @name ws/conversation-relay
 * @function
 * @param {WebSocket} ws - The WebSocket connection object
 *
 * @listens message
 * Expects JSON messages with the following structure:
 * - First message must be a setup message containing initial configuration
 * - Subsequent messages should follow the conversation relay protocol
 *
 * @listens close
 * Handles client disconnection by cleaning up resources
 *
 * @listens error
 * Handles WebSocket errors and performs cleanup
 *
 * @emits message
 * Sends JSON messages back to the client with conversation updates and responses
 */
app.ws("/conversation-relay", (ws: any, req: express.Request) => {
  let sessionConversationRelay: ConversationRelayService | null = null;
  let sessionData: SessionData = {
    parameterData: {},
    setupData: {
      callSid: "",
      from: "",
    },
  };

  // Handle incoming messages for this WS session.
  ws.on("message", async (data: string) => {
    try {
      const message: IncomingMessage = JSON.parse(data);
      // logOut('WS', `Received message of type: ${message.type}`);
      // If the sessionConversationRelay does not exist, initialise it else handle the incoming message
      if (!sessionConversationRelay) {
        logOut("WS", `Session Conversation Relay being initialised`);

        // Since this is the first message from CR, it will be a setup message, so add the Conversation Relay "setup" message data to the session.
        logOut(
          "WS",
          `Adding setup CR setup message data to sessionData. Message type: ${message.type} and callReference: ${message.customParameters?.callReference}`
        );

        sessionData.setupData = message as any;

        // This extracts the parameter data from the parameterDataMap and add it to the sessionData
        if (message.customParameters?.callReference) {
          sessionData.parameterData = parameterDataMap.get(
            message.customParameters.callReference
          ) || { requestData: {} };
        }

        // This loads the initial context and manifest of Conversation Relay setup message
        let contextFile = message.customParameters?.contextFile;
        let toolManifestFile = message.customParameters?.toolManifestFile;

        // Create new response Service.
        logOut("WS", `Creating Response Service`);
        const sessionResponseService = new OpenAIService();
        // const sessionResponseService = new DeepSeekService();
        // const sessionResponseService = new MCPResponseService();

        // Add an event listener for the response service for this particular session based on the call SID. This allows any endpoint to send a message to Session Response Service.
        if (message.callSid) {
          sessionResponseService.on(
            `responseService.${message.callSid}`,
            (responseMessage: any) => {
              logOut(
                "WS",
                `Got a call SID event for the session response service: ${JSON.stringify(
                  responseMessage
                )}`
              );
              // Send the message to the Session Response Service
              // sessionResponseService.incomingMessage(responseMessage);
            }
          );
        }

        logOut("WS", `Creating ConversationRelayService`);
        sessionConversationRelay = new ConversationRelayService(
          sessionResponseService,
          sessionData
        );

        // Attach the Event listener to send event messages from the Conversation Relay back to the WS client
        sessionConversationRelay.on(
          "conversationRelay.outgoingMessage",
          (outgoingMessage: any) => {
            // logOut('WS', `Sending message out: ${JSON.stringify(outgoingMessage)}`);
            ws.send(JSON.stringify(outgoingMessage));
          }
        );

        // Add the session to the wsSessionsMap, so it can be referenced using a particular call SID.
        if (message.callSid) {
          wsSessionsMap.set(message.callSid, {
            sessionConversationRelay,
            sessionResponseService,
            sessionData,
          });
        }
      }

      if (sessionConversationRelay) {
        sessionConversationRelay.incomingMessage(message);
      }
    } catch (error) {
      logError(
        "WS",
        `Error in websocket message handling: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    logOut("WS", "Client ws disconnected");
    // Clean up ConversationRelay and its listeners
    if (sessionConversationRelay) {
      sessionConversationRelay.cleanup();
    }
  });

  // Handle errors
  ws.on("error", (error: Error) => {
    logError(
      "WS",
      `WebSocket error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // Clean up ConversationRelay and its listeners
    if (sessionConversationRelay) {
      sessionConversationRelay.cleanup();
    }
  });
});

/****************************************************
 *
 * Web Server Endpoints
 *
 ****************************************************/

/**
 * Basic health check endpoint to verify server status.
 *
 * @name GET /
 * @function
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {string} Simple text response indicating server is running
 */
app.get("/", (req: express.Request, res: express.Response) => {
  res.send("WebSocket Server Running");
});

/**
 * Initiates an outbound call and connects it to the Conversation Relay via the Twilio Service service. The intention is to provide any amount of data in this request, but
 * that only the reference will be used to connect to the Conversation Relay. Once the reference is connected via Conversation Relay, it can be used to look up the full data set
 * stored here again. This illustrates how to pass parameters via the Conversation Relay Parameter field.
 *
 * Call this endpoint with some sample data.
 *
 * ``` terminal
 * curl  -X POST \
 *  'https://server-des.ngrok.dev/outboundCall' \
 *  --header 'Content-Type: application/json' \
 *  --data-raw '{
 *      "properties": {
 *          "phoneNumber": "+1234567890",
 *          "callReference": "abc123",
 *          "firstname": "Bob",
 *          "lastname": "Jones"
 *      }
 *   }'
 * ```
 * This data will be stored in a local Map and can be retrieved via the callReference.
 *
 * @endpoint POST /outboundCall
 *
 * @param {Object} req.body.properties - API request data properties
 * @param {string} req.body.properties.phoneNumber - [REQUIRED] Call's outbound phone number to call
 * @param {string} req.body.properties.callReference - [OPTIONAL] Unique reference to pass along with the call
 *
 * @returns {Object} response
 * @returns {string} [response.error] - Error message if the call failed
 *
 */
app.post(
  "/outboundCall",
  async (req: express.Request, res: express.Response) => {
    const requestData: RequestData = req.body;

    if (requestData.properties?.callReference) {
      parameterDataMap.set(requestData.properties.callReference, {
        requestData: requestData.properties,
      });
    }

    try {
      logOut("Server", `/outboundCall: Initiating outbound call`);
      // const twilioService = new TwilioService();

      if (!requestData.properties?.phoneNumber) {
        throw new Error("Phone number is required");
      }

      const response = await twilioService.makeOutboundCall(
        serverBaseUrl,
        requestData.properties.phoneNumber,
        requestData.properties.callReference || ""
      );

      logOut(
        "Server",
        `/outboundCall: Call initiated with call SID: ${response}`
      );

      res.json({ success: true, response: response });
    } catch (error) {
      logError(
        "Server",
        `Error initiating outbound call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Initiates a connection to the Conversation Relay service.
 *
 * @name POST /connectConversationRelay
 * @function
 * @async
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {Object} req.body - Request body
 * @param {string} req.body.callReference - Call reference identifier
 * @param {string} req.body.serverBaseUrl - Base URL of the server
 * @returns {string} TwiML response for establishing the connection
 */
app.post(
  "/connectConversationRelay",
  async (req: express.Request, res: express.Response) => {
    logOut("Server", `Received request to connect to Conversation Relay`);
    // const twilioService = new TwilioService();

    const twiml = twilioService.connectConversationRelay(serverBaseUrl);
    if (twiml) {
      res.send(twiml.toString());
    } else {
      res.status(500).send("Failed to generate TwiML");
    }
  }
);

/**
 * Endpoint to receive Twilio status callbacks and pass them to the Response Service if needed. The Twilio Service will decide what to do with the status callback.
 */
app.post(
  "/twilioStatusCallback",
  async (req: express.Request, res: express.Response) => {
    const statusCallBack = req.body;
    // Extract the call SID from the statusCallBack and insert the content into the sessionMap overwriting the existing content.
    const callSid = statusCallBack.callSid;
    logOut(
      "Server",
      `Received a Twilio status call back for call SID: ${callSid}: ${JSON.stringify(
        statusCallBack
      )}`
    );

    // Get the session objects from the wsSessionsMap
    let wsSession = wsSessionsMap.get(callSid);

    if (wsSession) {
      let sessionResponseService = wsSession.sessionResponseService;

      // Let the Twilio Service decide what to give back to the Response Service.
      // const twilioService = new TwilioService();
      const evaluatedStatusCallback =
        await twilioService.evaluateStatusCallback(statusCallBack);

      // Now Send the message to the Session Response Service directly if needed. NOTE: It is assumed that Twilio Service will manipulate the content based on it's understanding of the message and if no action is required, null it.
      if (evaluatedStatusCallback) {
        sessionResponseService.insertMessageIntoContext(
          "system",
          JSON.stringify(evaluatedStatusCallback)
        );
      }
    }

    res.json({ success: true });
  }
);

app.post(
  "/updateResponseService",
  async (req: express.Request, res: express.Response) => {
    const requestData: RequestData = req.body;
    logOut(
      "Server",
      `Received request to update Response Service with data: ${JSON.stringify(
        requestData
      )}`
    );

    // This loads the initial context and manifest of Conversation Relay setup message
    let callSid = requestData.callSid;
    let contextFile = requestData.contextFile;
    let toolManifestFile = requestData.toolManifestFile;

    if (callSid && contextFile && toolManifestFile) {
      logOut(
        "Server",
        `Changing context and manifest files for call SID: ${callSid} to: ${contextFile} and ${toolManifestFile}`
      );

      // Get the session objects from the wsSessionsMap
      let wsSession = wsSessionsMap.get(callSid);

      if (wsSession) {
        let sessionResponseService = wsSession.sessionResponseService;
        // Now update the context and manifest files for the sessionResponseService.
        sessionResponseService.updateContextAndManifest(
          contextFile,
          toolManifestFile
        );
      }
    }

    res.json({ success: true });
  }
);

/**
 * Webhook endpoint to receive Twilio Voice Intelligence / Conversational Intelligence transcripts
 * and add them to ServiceNow tickets for documentation and analysis purposes.
 *
 * @name POST /voiceIntelligenceWebhook
 * @function
 * @async
 * @param {express.Request} req - Express request object containing Voice Intelligence data
 * @param {express.Response} res - Express response object
 *
 * Expected webhook payload from Twilio Voice Intelligence:
 * {
 *   "TranscriptSid": "GT...",
 *   "CallSid": "CA...",
 *   "AccountSid": "AC...",
 *   "From": "+1234567890",
 *   "To": "+0987654321",
 *   "CallStartTime": "2024-01-01T10:00:00Z",
 *   "CallEndTime": "2024-01-01T10:05:00Z",
 *   "CallDuration": "300",
 *   "TranscriptText": "Full conversation transcript...",
 *   "Channels": [...],
 *   "LanguageCode": "en-US",
 *   "CallReference": "abc123" // Custom parameter if available
 * }
 */
app.post(
  "/voiceIntelligenceWebhook",
  async (req: express.Request, res: express.Response) => {
    try {
      const voiceIntelligenceData = req.body;
      logOut(
        "Server",
        `Received Voice Intelligence webhook for Call SID: ${voiceIntelligenceData.CallSid}`
      );

      // Extract key information from the webhook
      const callSid = voiceIntelligenceData.CallSid;
      const transcriptText = voiceIntelligenceData.TranscriptText;
      const callStartTime = voiceIntelligenceData.CallStartTime;
      const callEndTime = voiceIntelligenceData.CallEndTime;
      const callDuration = voiceIntelligenceData.CallDuration;
      const fromNumber = voiceIntelligenceData.From;
      const toNumber = voiceIntelligenceData.To;
      const callReference = voiceIntelligenceData.CallReference;

      if (!callSid || !transcriptText) {
        logError(
          "Server",
          "Voice Intelligence webhook missing required fields: CallSid or TranscriptText"
        );
        return res.status(400).json({
          success: false,
          error: "Missing required fields: CallSid or TranscriptText",
        });
      }

      // Try to find the ticket to update based on call reference or session data
      let ticketNumber = null;

      // Method 1: Check if we have call reference from parameter data
      if (callReference) {
        const parameterData = parameterDataMap.get(callReference);
        if (parameterData && parameterData.requestData.ticketNumber) {
          ticketNumber = parameterData.requestData.ticketNumber;
          logOut(
            "Server",
            `Found ticket ${ticketNumber} from call reference ${callReference}`
          );
        }
      }

      // Method 2: Check active session data for this call
      if (!ticketNumber) {
        const wsSession = wsSessionsMap.get(callSid);
        if (wsSession && wsSession.sessionData.parameterData.ticketNumber) {
          ticketNumber = wsSession.sessionData.parameterData.ticketNumber;
          logOut(
            "Server",
            `Found ticket ${ticketNumber} from active session data`
          );
        }
      }

      // Method 3: Look up customer by phone number and find recent tickets
      if (!ticketNumber && fromNumber) {
        try {
          // Import the lookup-customer tool function
          const lookupCustomerModule = await import(
            "./tools/lookup-customer.js"
          );
          const lookupCustomer = lookupCustomerModule.default;

          const customerLookupResult = await lookupCustomer({
            phoneNumber: fromNumber,
          });

          if (
            customerLookupResult.success &&
            customerLookupResult.openTickets &&
            customerLookupResult.openTickets.length > 0
          ) {
            // Use the most recent open ticket
            ticketNumber = customerLookupResult.openTickets[0].number;
            logOut(
              "Server",
              `Found recent ticket ${ticketNumber} for customer with phone ${fromNumber}`
            );
          }
        } catch (error) {
          logError(
            "Server",
            `Error looking up customer for transcript: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // If we found a ticket, add the transcript to it
      if (ticketNumber) {
        try {
          // Import the update-servicenow-ticket tool function
          const updateTicketModule = await import(
            "./tools/update-servicenow-ticket.js"
          );
          const updateTicket = updateTicketModule.default;

          // Format the transcript for ServiceNow work notes
          const formattedTranscript = `
=== CALL TRANSCRIPT ===
Call SID: ${callSid}
Call Duration: ${callDuration} seconds
Call Time: ${callStartTime} to ${callEndTime}
From: ${fromNumber}
To: ${toNumber}

FULL TRANSCRIPT:
${transcriptText}

=== END TRANSCRIPT ===
Generated by Twilio Voice Intelligence
                `.trim();

          const updateResult = await updateTicket({
            ticketNumber: ticketNumber,
            workNotes: formattedTranscript,
          });

          if (updateResult.success) {
            logOut(
              "Server",
              `Successfully added transcript to ticket ${ticketNumber}`
            );
            res.json({
              success: true,
              message: `Transcript added to ticket ${ticketNumber}`,
              ticketNumber: ticketNumber,
              callSid: callSid,
            });
          } else {
            logError(
              "Server",
              `Failed to update ticket ${ticketNumber}: ${updateResult.message}`
            );
            res.status(500).json({
              success: false,
              error: `Failed to update ticket: ${updateResult.message}`,
              ticketNumber: ticketNumber,
            });
          }
        } catch (error) {
          logError(
            "Server",
            `Error updating ServiceNow ticket: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          res.status(500).json({
            success: false,
            error: "Failed to update ServiceNow ticket",
            callSid: callSid,
          });
        }
      } else {
        // No ticket found - log transcript for manual processing
        logOut(
          "Server",
          `No ticket found for Call SID ${callSid}. Transcript received but not added to ServiceNow.`
        );
        logOut(
          "Server",
          `Transcript preview: ${transcriptText.substring(0, 200)}...`
        );

        res.json({
          success: true,
          message: "Transcript received but no associated ticket found",
          callSid: callSid,
          action: "logged_only",
        });
      }
    } catch (error) {
      logError(
        "Server",
        `Error processing Voice Intelligence webhook: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        success: false,
        error: "Internal server error processing transcript webhook",
      });
    }
  }
);

/**
 * Webhook endpoint to receive Twilio call recording notifications
 * and attach the recording URL to ServiceNow tickets for documentation.
 *
 * @name POST /callRecordingWebhook
 * @function
 * @async
 * @param {express.Request} req - Express request object containing recording data
 * @param {express.Response} res - Express response object
 *
 * Expected webhook payload from Twilio Recording:
 * {
 *   "RecordingSid": "RE...",
 *   "CallSid": "CA...",
 *   "AccountSid": "AC...",
 *   "RecordingUrl": "https://api.twilio.com/2010-04-01/Accounts/.../Recordings/RE.../",
 *   "RecordingDuration": "180",
 *   "RecordingChannels": "1",
 *   "RecordingSource": "DialVerb",
 *   "RecordingStatus": "completed",
 *   "DateCreated": "2024-01-01T10:05:00Z",
 *   "From": "+1234567890",
 *   "To": "+0987654321",
 *   "CallReference": "abc123" // Custom parameter if available
 * }
 */
app.post(
  "/callRecordingWebhook",
  async (req: express.Request, res: express.Response) => {
    try {
      const recordingData = req.body;
      logOut(
        "Server",
        `Received call recording webhook for Call SID: ${recordingData.CallSid}, Recording SID: ${recordingData.RecordingSid}`
      );

      // Extract key information from the webhook
      const callSid = recordingData.CallSid;
      const recordingSid = recordingData.RecordingSid;
      const recordingUrl = recordingData.RecordingUrl;
      const recordingDuration = recordingData.RecordingDuration;
      const recordingStatus = recordingData.RecordingStatus;
      const dateCreated = recordingData.DateCreated;
      const fromNumber = recordingData.From;
      const toNumber = recordingData.To;
      const callReference = recordingData.CallReference;

      if (!callSid || !recordingSid || !recordingUrl) {
        logError(
          "Server",
          "Call recording webhook missing required fields: CallSid, RecordingSid, or RecordingUrl"
        );
        return res.status(400).json({
          success: false,
          error:
            "Missing required fields: CallSid, RecordingSid, or RecordingUrl",
        });
      }

      // Only process completed recordings
      if (recordingStatus !== "completed") {
        logOut(
          "Server",
          `Recording ${recordingSid} status is ${recordingStatus}, skipping processing`
        );
        return res.json({
          success: true,
          message: `Recording status is ${recordingStatus}, will process when completed`,
          recordingSid: recordingSid,
          callSid: callSid,
        });
      }

      // Try to find the ticket to update using the same logic as Voice Intelligence
      let ticketNumber = null;

      // Method 1: Check if we have call reference from parameter data
      if (callReference) {
        const parameterData = parameterDataMap.get(callReference);
        if (parameterData && parameterData.requestData.ticketNumber) {
          ticketNumber = parameterData.requestData.ticketNumber;
          logOut(
            "Server",
            `Found ticket ${ticketNumber} from call reference ${callReference}`
          );
        }
      }

      // Method 2: Check active session data for this call
      if (!ticketNumber) {
        const wsSession = wsSessionsMap.get(callSid);
        if (wsSession && wsSession.sessionData.parameterData.ticketNumber) {
          ticketNumber = wsSession.sessionData.parameterData.ticketNumber;
          logOut(
            "Server",
            `Found ticket ${ticketNumber} from active session data`
          );
        }
      }

      // Method 3: Look up customer by phone number and find recent tickets
      if (!ticketNumber && fromNumber) {
        try {
          // Import the lookup-customer tool function
          const lookupCustomerModule = await import(
            "./tools/lookup-customer.js"
          );
          const lookupCustomer = lookupCustomerModule.default;

          const customerLookupResult = await lookupCustomer({
            phoneNumber: fromNumber,
          });

          if (
            customerLookupResult.success &&
            customerLookupResult.openTickets &&
            customerLookupResult.openTickets.length > 0
          ) {
            // Use the most recent open ticket
            ticketNumber = customerLookupResult.openTickets[0].number;
            logOut(
              "Server",
              `Found recent ticket ${ticketNumber} for customer with phone ${fromNumber}`
            );
          }
        } catch (error) {
          logError(
            "Server",
            `Error looking up customer for recording: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // If we found a ticket, add the recording information to it
      if (ticketNumber) {
        try {
          // Import the update-servicenow-ticket tool function
          const updateTicketModule = await import(
            "./tools/update-servicenow-ticket.js"
          );
          const updateTicket = updateTicketModule.default;

          // Create download URL with authentication for ServiceNow access
          const downloadUrl = `${recordingUrl}.mp3`; // Twilio provides .mp3 format

          // Format the recording information for ServiceNow work notes
          const recordingInfo = `
=== CALL RECORDING ===
Recording SID: ${recordingSid}
Call SID: ${callSid}
Recording Duration: ${recordingDuration} seconds
Recording Date: ${dateCreated}
From: ${fromNumber}
To: ${toNumber}

RECORDING DOWNLOAD:
${downloadUrl}

NOTE: This recording can be downloaded using Twilio API credentials.
Access the recording at: ${recordingUrl}

=== END RECORDING INFO ===
Generated by Twilio Recording Webhook
                `.trim();

          const updateResult = await updateTicket({
            ticketNumber: ticketNumber,
            workNotes: recordingInfo,
          });

          if (updateResult.success) {
            logOut(
              "Server",
              `Successfully added recording info to ticket ${ticketNumber}`
            );

            // Attempt to attach the recording as a file to the ServiceNow ticket
            try {
              await attachRecordingToServiceNow(
                ticketNumber,
                recordingUrl,
                recordingSid,
                recordingDuration
              );
              logOut(
                "Server",
                `Successfully attached recording file to ticket ${ticketNumber}`
              );
            } catch (attachError) {
              logError(
                "Server",
                `Failed to attach recording file to ticket: ${
                  attachError instanceof Error
                    ? attachError.message
                    : String(attachError)
                }`
              );
              // Continue with success response even if attachment fails
            }

            res.json({
              success: true,
              message: `Recording information added to ticket ${ticketNumber}`,
              ticketNumber: ticketNumber,
              callSid: callSid,
              recordingSid: recordingSid,
              recordingUrl: downloadUrl,
            });
          } else {
            logError(
              "Server",
              `Failed to update ticket ${ticketNumber}: ${updateResult.message}`
            );
            res.status(500).json({
              success: false,
              error: `Failed to update ticket: ${updateResult.message}`,
              ticketNumber: ticketNumber,
            });
          }
        } catch (error) {
          logError(
            "Server",
            `Error updating ServiceNow ticket with recording: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          res.status(500).json({
            success: false,
            error: "Failed to update ServiceNow ticket with recording",
            callSid: callSid,
            recordingSid: recordingSid,
          });
        }
      } else {
        // No ticket found - log recording for manual processing
        logOut(
          "Server",
          `No ticket found for Call SID ${callSid}. Recording ${recordingSid} received but not added to ServiceNow.`
        );
        logOut("Server", `Recording URL: ${recordingUrl}`);

        res.json({
          success: true,
          message: "Recording received but no associated ticket found",
          callSid: callSid,
          recordingSid: recordingSid,
          action: "logged_only",
        });
      }
    } catch (error) {
      logError(
        "Server",
        `Error processing call recording webhook: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        success: false,
        error: "Internal server error processing recording webhook",
      });
    }
  }
);

/**
 * Helper function to attach a Twilio recording to a ServiceNow ticket as a file attachment
 * This function downloads the recording from Twilio and uploads it to ServiceNow
 */
async function attachRecordingToServiceNow(
  ticketNumber: string,
  recordingUrl: string,
  recordingSid: string,
  duration: string
): Promise<void> {
  const serviceNowInstance = process.env.SERVICENOW_INSTANCE;
  const serviceNowUsername = process.env.SERVICENOW_USERNAME;
  const serviceNowPassword = process.env.SERVICENOW_PASSWORD;
  const accountSid = process.env.ACCOUNT_SID;
  const authToken = process.env.AUTH_TOKEN;

  if (
    !serviceNowInstance ||
    !serviceNowUsername ||
    !serviceNowPassword ||
    !accountSid ||
    !authToken
  ) {
    throw new Error("Missing required credentials for recording attachment");
  }

  try {
    // Step 1: Get the ticket sys_id
    const auth = Buffer.from(
      `${serviceNowUsername}:${serviceNowPassword}`
    ).toString("base64");
    const ticketApiUrl = `https://${serviceNowInstance}.service-now.com/api/now/table/incident`;
    const findQueryParams = new URLSearchParams({
      sysparm_query: `number=${ticketNumber}`,
      sysparm_fields: "sys_id",
    });

    const findResponse = await fetch(`${ticketApiUrl}?${findQueryParams}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!findResponse.ok) {
      throw new Error(
        `Failed to find ticket ${ticketNumber}: ${findResponse.status}`
      );
    }

    const findData = await findResponse.json();
    if (!findData.result || findData.result.length === 0) {
      throw new Error(`Ticket ${ticketNumber} not found`);
    }

    const ticketSysId = findData.result[0].sys_id;

    // Step 2: Download the recording from Twilio
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64"
    );
    const recordingResponse = await fetch(`${recordingUrl}.mp3`, {
      headers: {
        Authorization: `Basic ${twilioAuth}`,
      },
    });

    if (!recordingResponse.ok) {
      throw new Error(
        `Failed to download recording: ${recordingResponse.status}`
      );
    }

    const recordingBuffer = await recordingResponse.arrayBuffer();

    // Step 3: Upload the recording to ServiceNow as an attachment
    const attachmentApiUrl = `https://${serviceNowInstance}.service-now.com/api/now/attachment/file`;
    const fileName = `call_recording_${recordingSid}_${duration}s.mp3`;

    const formData = new FormData();
    formData.append("table_name", "incident");
    formData.append("table_sys_id", ticketSysId);
    formData.append("file_name", fileName);
    formData.append("encryption_context", "");

    // Convert ArrayBuffer to Blob for FormData
    const recordingBlob = new Blob([recordingBuffer], { type: "audio/mpeg" });
    formData.append("uploadFile", recordingBlob, fileName);

    const uploadResponse = await fetch(attachmentApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload recording to ServiceNow: ${uploadResponse.status} ${uploadResponse.statusText}`
      );
    }

    const uploadResult = await uploadResponse.json();
    logOut(
      "Server",
      `Recording attached to ServiceNow ticket ${ticketNumber}: ${uploadResult.result.sys_id}`
    );
  } catch (error) {
    logError(
      "Server",
      `Error in attachRecordingToServiceNow: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

/****************************************************
 *
 * Web Server
 *
 ****************************************************/

/**
 * Server initialization and port management.
 * Attempts to start the server on the configured port (from environment or default 3000).
 * If the port is in use, incrementally tries the next port number.
 *
 * @function startServer
 * @returns {http.Server} Express server instance
 * @throws {Error} If server fails to start for reasons other than port in use
 */
let currentPort = Number(PORT);

const startServer = (port: number): void => {
  // logOut('Server', `Starting server on port ${port}`);
  const server = app.listen(port);

  server.on("error", (error: NodeJS.ErrnoException) => {
    // Server emits events for errors
    if (error.code === "EADDRINUSE") {
      server.close();
      logOut("Server", `Port ${port} is in use, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      logError("Server", `Failed to start server: ${error.message}`);
      throw error;
    }
  });

  server.on("listening", () => {
    logOut("Server", `Server started on port ${port}`);
  });
};

startServer(currentPort);
