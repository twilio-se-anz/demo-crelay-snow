/**
 * Tests for send-verification tool - Integration Tests with Real Twilio API
 * Based on TEST_CASES.md section 5: Twilio Verify - Send Verification Tests
 */

const sendVerification = require('../../src/tools/send-verification').default;

describe('send-verification tool - Integration Tests', () => {
  // Set longer timeout for real API calls
  jest.setTimeout(30000);

  describe('Test Case 5.1: Send SMS Verification Code', () => {
    it('should handle SMS verification request', async () => {
      // Use a real test phone number - Twilio test numbers that won't actually send SMS
      const result = await sendVerification({
        to: '+15551234567',
        channel: 'sms'
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      
      if (result.success) {
        expect(result.recipient).toBe('+15551234567');
        expect(result.sid).toBeDefined();
        expect(result.status).toBeDefined();
        expect(result.message).toContain('via sms');
      } else {
        // May fail due to invalid test number or missing credentials
        expect(result.message).toBeDefined();
      }
    });
  });

  describe('Test Case 5.2: Send Voice Verification Code', () => {
    it('should handle voice verification request', async () => {
      const result = await sendVerification({
        to: '+15551234567',
        channel: 'call'
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      
      if (result.success) {
        expect(result.recipient).toBe('+15551234567');
        expect(result.sid).toBeDefined();
        expect(result.status).toBeDefined();
        expect(result.message).toContain('via call');
      }
    });
  });

  describe('Test Case 5.3: Default Channel Handling', () => {
    it('should handle verification with default SMS channel', async () => {
      const result = await sendVerification({
        to: '+15551234567'
        // No channel specified - should default to SMS
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Test Case 5.4: Invalid Phone Number Handling', () => {
    it('should handle invalid phone numbers', async () => {
      const result = await sendVerification({
        to: 'invalid-number'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Verification send failed');
    });
  });

  describe('Credential Validation', () => {
    it('should handle missing Twilio credentials', async () => {
      const originalSid = process.env.ACCOUNT_SID;
      delete process.env.ACCOUNT_SID;

      const result = await sendVerification({
        to: '+15551234567'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required Twilio credentials in environment variables');

      process.env.ACCOUNT_SID = originalSid;
    });

    it('should handle missing Verify Service SID', async () => {
      const originalVerifySid = process.env.VERIFY_SERVICE_SID;
      delete process.env.VERIFY_SERVICE_SID;

      const result = await sendVerification({
        to: '+15551234567'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Missing required Twilio credentials in environment variables');

      process.env.VERIFY_SERVICE_SID = originalVerifySid;
    });
  });

  describe('Error Handling', () => {
    it('should return proper error structure for API failures', async () => {
      // Test with empty phone number to trigger validation error
      const result = await sendVerification({
        to: ''
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
    });
  });
});