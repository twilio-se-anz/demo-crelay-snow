/**
 * Simple test to verify Jest setup is working
 */

describe("Basic Jest Setup", () => {
  it("should run basic tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("should have test environment variables", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.SERVICENOW_INSTANCE).toBe(
      "https://dev351941.service-now.com"
    );
  });

  it("should be able to mock functions", () => {
    const mockFn = jest.fn();
    mockFn("test");
    expect(mockFn).toHaveBeenCalledWith("test");
  });
});
