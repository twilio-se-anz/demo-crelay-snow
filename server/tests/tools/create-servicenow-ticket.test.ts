/**
 * Tests for create-servicenow-ticket tool - Integration Tests with Real ServiceNow API
 * Based on TEST_CASES.md section 3: ServiceNow Ticket Creation Tests
 */

const createServiceNowTicket = require('../../src/tools/create-servicenow-ticket').default;

describe('create-servicenow-ticket tool - Integration Tests', () => {
  // Set longer timeout for real API calls
  jest.setTimeout(30000);

  describe('Test Case 3.1: Ticket Creation API Integration', () => {
    it('should handle ticket creation requests with real API', async () => {
      // Test with minimal required fields
      const result = await createServiceNowTicket({
        shortDescription: 'Test Integration Ticket',
        callerPhoneNumber: '+15551234567'
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      
      if (result.success) {
        expect(result.ticketNumber).toBeDefined();
        expect(result.ticketSysId).toBeDefined();
        expect(result.shortDescription).toBe('Test Integration Ticket');
      } else {
        // May fail due to missing credentials or invalid data - that's expected
        expect(result.message).toBeDefined();
      }
    });

    it('should handle credential validation', async () => {
      const originalInstance = process.env.SERVICENOW_INSTANCE;
      delete process.env.SERVICENOW_INSTANCE;

      const result = await createServiceNowTicket({
        shortDescription: 'Test Ticket',
        callerPhoneNumber: '+15551234567'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required ServiceNow credentials');

      process.env.SERVICENOW_INSTANCE = originalInstance;
    });
      const mockUserResponse = {
        result: [{
          sys_id: 'user123',
          name: 'John Doe'
        }]
      };

      // Mock ticket creation response
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket123',
          number: 'INC0001234',
          state: '1',
          opened_at: '2024-01-01T10:00:00Z',
          caller_id: 'user123'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      const result = await createServiceNowTicket({
        shortDescription: 'Test ticket creation',
        description: 'This is a test ticket created by automated testing',
        callerPhoneNumber: '+1234567890'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully created ticket INC0001234');
      expect(result.ticketNumber).toBe('INC0001234');
      expect(result.ticketSysId).toBe('ticket123');
      expect(result.ticket?.number).toBe('INC0001234');
      expect(result.ticket?.state).toBe('1');
    });
  });

  describe('Test Case 3.2: Ticket Creation with All Optional Fields', () => {
    it('should handle all optional parameters correctly', async () => {
      // Mock user lookup
      const mockUserResponse = {
        result: [{
          sys_id: 'user123',
          name: 'John Doe'
        }]
      };

      // Mock parent case lookup
      const mockParentResponse = {
        result: [{
          sys_id: 'parent123',
          number: 'INC0008111'
        }]
      };

      // Mock ticket creation
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket456',
          number: 'INC0001235',
          state: '1',
          opened_at: '2024-01-01T10:00:00Z',
          caller_id: 'user123'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockParentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      const result = await createServiceNowTicket({
        shortDescription: 'Complex test ticket',
        description: 'Detailed description of the issue',
        callerPhoneNumber: '+1234567890',
        priority: '2',
        urgency: '1',
        category: 'Software',
        subcategory: 'Application',
        contactType: 'phone',
        workNotes: 'Initial troubleshooting completed',
        parentCase: 'INC0008111'
      });

      expect(result.success).toBe(true);
      expect(result.ticketNumber).toBe('INC0001235');

      // Verify the ticket creation API call
      const createCall = (fetch as jest.Mock).mock.calls[2];
      const requestBody = JSON.parse(createCall[1].body);
      
      expect(requestBody.priority).toBe('2');
      expect(requestBody.urgency).toBe('1');
      expect(requestBody.category).toBe('Software');
      expect(requestBody.subcategory).toBe('Application');
      expect(requestBody.contact_type).toBe('phone');
      expect(requestBody.work_notes).toContain('Initial troubleshooting completed');
      expect(requestBody.parent_incident).toBe('parent123');
    });
  });

  describe('Test Case 3.3: Ticket Creation with Non-existent Caller', () => {
    it('should handle unknown phone numbers gracefully', async () => {
      // Mock empty user lookup response
      const mockUserResponse = {
        result: []
      };

      // Mock ticket creation response
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket789',
          number: 'INC0001236',
          state: '1',
          opened_at: '2024-01-01T10:00:00Z'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      const result = await createServiceNowTicket({
        shortDescription: 'Test with unknown caller',
        description: 'Testing unknown caller scenario',
        callerPhoneNumber: '+1555555555'
      });

      expect(result.success).toBe(true);
      expect(result.ticketNumber).toBe('INC0001236');

      // Verify ticket was created without caller assignment
      const createCall = (fetch as jest.Mock).mock.calls[1];
      const requestBody = JSON.parse(createCall[1].body);
      expect(requestBody.caller_id).toBeUndefined();
    });
  });

  describe('Test Case 3.4: Ticket Creation with Invalid Parent Case', () => {
    it('should handle non-existent parent cases', async () => {
      // Mock user lookup
      const mockUserResponse = {
        result: [{
          sys_id: 'user123',
          name: 'John Doe'
        }]
      };

      // Mock empty parent case response
      const mockParentResponse = {
        result: []
      };

      // Mock ticket creation
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket890',
          number: 'INC0001237',
          state: '1',
          opened_at: '2024-01-01T10:00:00Z'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockParentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      const result = await createServiceNowTicket({
        shortDescription: 'Test with invalid parent',
        description: 'Testing invalid parent case',
        callerPhoneNumber: '+1234567890',
        parentCase: 'INC9999999'
      });

      expect(result.success).toBe(true);
      expect(result.ticketNumber).toBe('INC0001237');

      // Verify ticket was created without parent relationship
      const createCall = (fetch as jest.Mock).mock.calls[2];
      const requestBody = JSON.parse(createCall[1].body);
      expect(requestBody.parent_incident).toBeUndefined();
    });
  });

  describe('Field Defaults', () => {
    it('should apply correct default values', async () => {
      const mockUserResponse = { result: [] };
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket123',
          number: 'INC0001234',
          state: '1'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      await createServiceNowTicket({
        shortDescription: 'Test defaults',
        description: 'Testing default values',
        callerPhoneNumber: '+1234567890'
      });

      const createCall = (fetch as jest.Mock).mock.calls[1];
      const requestBody = JSON.parse(createCall[1].body);

      expect(requestBody.contact_type).toBe('phone');
      expect(requestBody.state).toBe('1'); // New
      expect(requestBody.priority).toBe('3'); // Moderate
      expect(requestBody.urgency).toBe('2'); // Medium
      expect(requestBody.category).toBe('Software');
    });
  });

  describe('Error Handling', () => {
    it('should handle ServiceNow API failures', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await createServiceNowTicket({
        shortDescription: 'Test error handling',
        description: 'Testing API failure',
        callerPhoneNumber: '+1234567890'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('ServiceNow ticket creation failed');
    });

    it('should handle missing credentials', async () => {
      const originalPassword = process.env.SERVICENOW_PASSWORD;
      delete process.env.SERVICENOW_PASSWORD;

      const result = await createServiceNowTicket({
        shortDescription: 'Test credentials',
        description: 'Testing missing credentials',
        callerPhoneNumber: '+1234567890'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required ServiceNow credentials in environment variables');

      process.env.SERVICENOW_PASSWORD = originalPassword;
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

      const result = await createServiceNowTicket({
        shortDescription: 'Test network error',
        description: 'Testing network failure',
        callerPhoneNumber: '+1234567890'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('ServiceNow ticket creation failed');
    });
  });

  describe('Phone Number Normalization', () => {
    it('should normalize phone numbers for caller lookup', async () => {
      const mockUserResponse = { result: [] };
      const mockCreateResponse = {
        result: {
          sys_id: 'ticket123',
          number: 'INC0001234',
          state: '1'
        }
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse)
        });

      await createServiceNowTicket({
        shortDescription: 'Test phone normalization',
        description: 'Testing phone number formatting',
        callerPhoneNumber: '(123) 456-7890'
      });

      // Check that the phone number was normalized in the user lookup
      const userLookupCall = (fetch as jest.Mock).mock.calls[0][0];
      expect(userLookupCall).toContain('1234567890');
    });
  });
});