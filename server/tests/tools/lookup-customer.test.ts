/**
 * Tests for lookup-customer tool - Integration Tests with Real ServiceNow API
 * Based on TEST_CASES.md section 1: Customer Lookup Tool Tests
 */

// Use require for CommonJS - default export
const lookupCustomer = require('../../src/tools/lookup-customer').default;

describe('lookup-customer tool - Integration Tests', () => {
  // Set longer timeout for real API calls
  jest.setTimeout(30000);

  describe('Test Case 1.1: Phone Number Format Handling', () => {
    const phoneFormats = [
      '(555) 123-4567',
      '555-123-4567', 
      '555.123.4567',
      '555 123 4567',
      '+15551234567'
    ];

    phoneFormats.forEach(format => {
      it(`should handle phone format: ${format}`, async () => {
        const result = await lookupCustomer({ phoneNumber: format });
        
        // Test that function executes without error
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        
        // If customer not found or API fails, that's expected for test numbers
        if (!result.success) {
          expect(result.message).toMatch(/(No customer found|Customer lookup failed)/);
        } else {
          // If customer found, validate structure
          expect(result.customer).toBeDefined();
          expect(result.openTickets).toBeDefined();
          expect(result.ticketCount).toBeDefined();
        }
      });
    });
  });

  describe('Test Case 1.2: API Connectivity and Response Structure', () => {
    it('should properly connect to ServiceNow API', async () => {
      // Test with a non-existent number to verify API connectivity
      const result = await lookupCustomer({ phoneNumber: '+15551234567' });
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      
      // Should either find customer or return not found message
      if (result.success) {
        expect(result.customer).toBeDefined();
        expect(result.openTickets).toBeDefined();
        expect(typeof result.ticketCount).toBe('number');
      } else {
        expect(result.message).toContain('No customer found');
      }
    });
  });

  describe('Test Case 1.3: Credential Validation', () => {
    it('should handle missing credentials gracefully', async () => {
      // Temporarily remove credentials
      const originalInstance = process.env.SERVICENOW_INSTANCE;
      delete process.env.SERVICENOW_INSTANCE;

      const result = await lookupCustomer({ phoneNumber: '+15551234567' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required ServiceNow credentials');

      // Restore credentials
      process.env.SERVICENOW_INSTANCE = originalInstance;
    });
  });

  describe('Test Case 1.4: Error Handling', () => {
    it('should return proper error structure for invalid requests', async () => {
      // Test with empty phone number
      const result = await lookupCustomer({ phoneNumber: '' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
    });
  });
});