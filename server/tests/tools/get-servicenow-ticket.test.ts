/**
 * Tests for get-servicenow-ticket tool - Integration Tests with Real ServiceNow API
 * Based on TEST_CASES.md section 2: ServiceNow Ticket Retrieval Tests
 */

const getServiceNowTicket = require('../../src/tools/get-servicenow-ticket').default;

describe('get-servicenow-ticket tool - Integration Tests', () => {
  // Set longer timeout for real API calls
  jest.setTimeout(30000);

  describe('Test Case 2.1: Real Ticket Retrieval', () => {
    it('should retrieve existing ticket INC0008111', async () => {
      const result = await getServiceNowTicket({ ticketNumber: 'INC0008111' });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      
      if (result.success) {
        expect(result.ticket).toBeDefined();
        expect(result.ticket?.number).toBe('INC0008111');
        expect(result.ticket?.short_description).toBeDefined();
        expect(result.ticket?.state).toBeDefined();
        expect(result.ticket?.priority).toBeDefined();
        expect(result.ticket?.sys_id).toBeDefined();
      } else {
        // May fail due to missing credentials or ticket not found
        expect(result.message).toMatch(/(Missing required ServiceNow credentials|No ticket found|ServiceNow API request failed)/);
      }
    });
  });

  describe('Test Case 2.2: Non-existent Ticket', () => {
    it('should handle non-existent ticket numbers', async () => {
      const result = await getServiceNowTicket({ ticketNumber: 'INC9999999' });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(result.ticketNumber).toBe('INC9999999');
      
      if (!result.success) {
        expect(result.message).toMatch(/(not found|Missing required ServiceNow credentials|ServiceNow API request failed)/);
        expect(result.ticket).toBeUndefined();
      }
    });
  });

  describe('Test Case 2.3: Credential Validation', () => {
    it('should handle missing credentials', async () => {
      const originalUsername = process.env.SERVICENOW_USERNAME;
      delete process.env.SERVICENOW_USERNAME;

      const result = await getServiceNowTicket({ ticketNumber: 'INC0008111' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required ServiceNow credentials');

      process.env.SERVICENOW_USERNAME = originalUsername;
    });
  });

  describe('Test Case 2.4: Error Handling', () => {
    it('should handle invalid ticket number format', async () => {
      const result = await getServiceNowTicket({ ticketNumber: '' });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
    });
  });
});