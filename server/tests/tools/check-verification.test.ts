/**
 * Tests for check-verification tool - Integration Tests with Real Twilio API  
 * Based on TEST_CASES.md section 6: Twilio Verify - Check Verification Tests
 */

const checkVerification = require('../../src/tools/check-verification').default;

describe('check-verification tool - Integration Tests', () => {
  // Set longer timeout for real API calls
  jest.setTimeout(30000);

  describe('Test Case 6.1: Verification Code Handling', () => {
    it('should handle verification check requests', async () => {
      // Test with typical verification data
      const result = await checkVerification({
        to: '+15551234567',
        code: '123456'
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(typeof result.verified).toBe('boolean');
      
      if (result.success) {
        expect(result.recipient).toBe('+15551234567');
        expect(result.status).toBeDefined();
        expect(result.sid).toBeDefined();
      }
    });
  });

  describe('Test Case 6.2: Invalid Verification Scenarios', () => {
    it('should handle invalid verification codes', async () => {
      const result = await checkVerification({
        to: '+15551234567',
        code: '000000'
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.verified).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Test Case 6.3: Credential Validation', () => {
    it('should handle missing Twilio credentials', async () => {
      const originalSid = process.env.ACCOUNT_SID;
      delete process.env.ACCOUNT_SID;

      const result = await checkVerification({
        to: '+15551234567',
        code: '123456'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required Twilio credentials in environment variables');

      process.env.ACCOUNT_SID = originalSid;
    });
  });

  describe('Test Case 6.4: Error Handling', () => {
    it('should handle invalid parameters', async () => {
      // Test with empty phone number
      const result = await checkVerification({
        to: '',
        code: '123456'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(typeof result.verified).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should handle empty verification code', async () => {
      const result = await checkVerification({
        to: '+15551234567',
        code: ''
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(typeof result.verified).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });
});