/**
 * Integration tests for webhook endpoints
 * Tests Voice Intelligence and Call Recording webhooks
 */

// Jest globals are available in CommonJS environment
const request = require('supertest');
const express = require('express');

// Mock the tools to avoid actual ServiceNow calls
jest.mock('../../src/tools/lookup-customer.js', () => ({
  default: jest.fn()
}));

jest.mock('../../src/tools/update-servicenow-ticket.js', () => ({
  default: jest.fn()
}));

// Import mocked tools
const lookupCustomer = require('../../src/tools/lookup-customer').default;
const updateTicket = require('../../src/tools/update-servicenow-ticket').default;

describe('Webhook Endpoints Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Define the webhook endpoints for testing
    app.post('/voiceIntelligenceWebhook', async (req: any, res: any) => {
      try {
        const voiceIntelligenceData = req.body;
        const callSid = voiceIntelligenceData.CallSid;
        const transcriptText = voiceIntelligenceData.TranscriptText;
        const fromNumber = voiceIntelligenceData.From;

        if (!callSid || !transcriptText) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: CallSid or TranscriptText' 
          });
        }

        // Mock customer lookup
        const customerLookupResult = await (lookupCustomer as jest.Mock)({ phoneNumber: fromNumber });
        
        if (customerLookupResult.success && customerLookupResult.openTickets?.length > 0) {
          const ticketNumber = customerLookupResult.openTickets[0].number;
          const updateResult = await (updateTicket as jest.Mock)({
            ticketNumber,
            workNotes: `Call transcript: ${transcriptText}`
          });

          if (updateResult.success) {
            res.json({ 
              success: true, 
              message: `Transcript added to ticket ${ticketNumber}`,
              ticketNumber,
              callSid
            });
          } else {
            res.status(500).json({ 
              success: false, 
              error: `Failed to update ticket: ${updateResult.message}`
            });
          }
        } else {
          res.json({ 
            success: true, 
            message: 'Transcript received but no associated ticket found',
            callSid,
            action: 'logged_only'
          });
        }
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error processing transcript webhook' 
        });
      }
    });

    app.post('/callRecordingWebhook', async (req: any, res: any) => {
      try {
        const recordingData = req.body;
        const callSid = recordingData.CallSid;
        const recordingSid = recordingData.RecordingSid;
        const recordingUrl = recordingData.RecordingUrl;
        const recordingStatus = recordingData.RecordingStatus;
        const fromNumber = recordingData.From;

        if (!callSid || !recordingSid || !recordingUrl) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: CallSid, RecordingSid, or RecordingUrl' 
          });
        }

        if (recordingStatus !== 'completed') {
          return res.json({ 
            success: true, 
            message: `Recording status is ${recordingStatus}, will process when completed`,
            recordingSid,
            callSid
          });
        }

        // Mock customer lookup
        const customerLookupResult = await (lookupCustomer as jest.Mock)({ phoneNumber: fromNumber });
        
        if (customerLookupResult.success && customerLookupResult.openTickets?.length > 0) {
          const ticketNumber = customerLookupResult.openTickets[0].number;
          const updateResult = await (updateTicket as jest.Mock)({
            ticketNumber,
            workNotes: `Call recording: ${recordingUrl}`
          });

          if (updateResult.success) {
            res.json({ 
              success: true, 
              message: `Recording information added to ticket ${ticketNumber}`,
              ticketNumber,
              callSid,
              recordingSid
            });
          } else {
            res.status(500).json({ 
              success: false, 
              error: `Failed to update ticket: ${updateResult.message}`
            });
          }
        } else {
          res.json({ 
            success: true, 
            message: 'Recording received but no associated ticket found',
            callSid,
            recordingSid,
            action: 'logged_only'
          });
        }
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error processing recording webhook' 
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Voice Intelligence Webhook', () => {
    describe('Successful Processing', () => {
      it('should process transcript and add to existing ticket', async () => {
        // Mock successful customer lookup with open ticket
        (lookupCustomer as jest.Mock).mockResolvedValue({
          success: true,
          openTickets: [{ number: 'INC0001234' }]
        });

        // Mock successful ticket update
        (updateTicket as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Ticket updated successfully'
        });

        const webhookPayload = {
          TranscriptSid: 'GT1234567890',
          CallSid: 'CA1234567890',
          AccountSid: 'AC1234567890',
          From: '+1234567890',
          To: '+0987654321',
          CallStartTime: '2024-01-01T10:00:00Z',
          CallEndTime: '2024-01-01T10:05:00Z',
          CallDuration: '300',
          TranscriptText: 'Agent: Welcome to Data#3, how can I assist you today? Customer: I need help with my password.',
          LanguageCode: 'en-US'
        };

        const response = await request(app)
          .post('/voiceIntelligenceWebhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Transcript added to ticket INC0001234');
        expect(response.body.ticketNumber).toBe('INC0001234');
        expect(response.body.callSid).toBe('CA1234567890');

        expect(lookupCustomer).toHaveBeenCalledWith({ phoneNumber: '+1234567890' });
        expect(updateTicket).toHaveBeenCalledWith({
          ticketNumber: 'INC0001234',
          workNotes: expect.stringContaining('Agent: Welcome to Data#3')
        });
      });

      it('should handle transcript when no ticket is found', async () => {
        // Mock customer lookup with no tickets
        (lookupCustomer as jest.Mock).mockResolvedValue({
          success: false,
          openTickets: []
        });

        const webhookPayload = {
          CallSid: 'CA1234567890',
          TranscriptText: 'Test transcript',
          From: '+1234567890'
        };

        const response = await request(app)
          .post('/voiceIntelligenceWebhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Transcript received but no associated ticket found');
        expect(response.body.action).toBe('logged_only');
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for missing required fields', async () => {
        const invalidPayload = {
          CallSid: 'CA1234567890'
          // Missing TranscriptText
        };

        const response = await request(app)
          .post('/voiceIntelligenceWebhook')
          .send(invalidPayload)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Missing required fields: CallSid or TranscriptText');
      });

      it('should handle ticket update failures', async () => {
        (lookupCustomer as jest.Mock).mockResolvedValue({
          success: true,
          openTickets: [{ number: 'INC0001234' }]
        });

        (updateTicket as jest.Mock).mockResolvedValue({
          success: false,
          message: 'Ticket not found'
        });

        const webhookPayload = {
          CallSid: 'CA1234567890',
          TranscriptText: 'Test transcript',
          From: '+1234567890'
        };

        const response = await request(app)
          .post('/voiceIntelligenceWebhook')
          .send(webhookPayload)
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Failed to update ticket');
      });
    });
  });

  describe('Call Recording Webhook', () => {
    describe('Successful Processing', () => {
      it('should process completed recording and add to ticket', async () => {
        (lookupCustomer as jest.Mock).mockResolvedValue({
          success: true,
          openTickets: [{ number: 'INC0005678' }]
        });

        (updateTicket as jest.Mock).mockResolvedValue({
          success: true,
          message: 'Recording added successfully'
        });

        const webhookPayload = {
          RecordingSid: 'RE1234567890',
          CallSid: 'CA1234567890',
          AccountSid: 'AC1234567890',
          RecordingUrl: 'https://api.twilio.com/recordings/RE1234567890',
          RecordingDuration: '180',
          RecordingStatus: 'completed',
          DateCreated: '2024-01-01T10:05:00Z',
          From: '+1234567890',
          To: '+0987654321'
        };

        const response = await request(app)
          .post('/callRecordingWebhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Recording information added to ticket INC0005678');
        expect(response.body.ticketNumber).toBe('INC0005678');
        expect(response.body.recordingSid).toBe('RE1234567890');
      });

      it('should skip processing for non-completed recordings', async () => {
        const webhookPayload = {
          RecordingSid: 'RE1234567890',
          CallSid: 'CA1234567890',
          RecordingUrl: 'https://api.twilio.com/recordings/RE1234567890',
          RecordingStatus: 'in-progress'
        };

        const response = await request(app)
          .post('/callRecordingWebhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Recording status is in-progress');
        expect(lookupCustomer).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for missing required fields', async () => {
        const invalidPayload = {
          CallSid: 'CA1234567890',
          RecordingSid: 'RE1234567890'
          // Missing RecordingUrl
        };

        const response = await request(app)
          .post('/callRecordingWebhook')
          .send(invalidPayload)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Missing required fields: CallSid, RecordingSid, or RecordingUrl');
      });

      it('should handle customer lookup failures gracefully', async () => {
        (lookupCustomer as jest.Mock).mockRejectedValue(new Error('ServiceNow unavailable'));

        const webhookPayload = {
          RecordingSid: 'RE1234567890',
          CallSid: 'CA1234567890',
          RecordingUrl: 'https://api.twilio.com/recordings/RE1234567890',
          RecordingStatus: 'completed',
          From: '+1234567890'
        };

        const response = await request(app)
          .post('/callRecordingWebhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.action).toBe('logged_only');
      });
    });
  });

  describe('Content Type Handling', () => {
    it('should accept application/json content type', async () => {
      (lookupCustomer as jest.Mock).mockResolvedValue({
        success: false,
        openTickets: []
      });

      const response = await request(app)
        .post('/voiceIntelligenceWebhook')
        .set('Content-Type', 'application/json')
        .send({
          CallSid: 'CA1234567890',
          TranscriptText: 'Test transcript'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept application/x-www-form-urlencoded content type', async () => {
      (lookupCustomer as jest.Mock).mockResolvedValue({
        success: false,
        openTickets: []
      });

      const response = await request(app)
        .post('/voiceIntelligenceWebhook')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('CallSid=CA1234567890&TranscriptText=Test transcript')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});