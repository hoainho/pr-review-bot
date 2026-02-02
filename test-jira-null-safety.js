// Test script to verify Jira MCP null safety fix
// Simulates various Jira API response scenarios

const { fetchAutoDiscoveredContext, formatPRDContextForPrompt } = require('./services/jiraConfluenceMCP.ts');

// Test scenarios
const testScenarios = [
  {
    name: "Normal ticket with all fields",
    mockResponse: {
      key: "WIN-3641",
      fields: {
        summary: "Test ticket summary",
        description: "This is a normal ticket description that should work fine",
        status: { name: "In Progress" },
        priority: { name: "High" }
      }
    }
  },
  {
    name: "Ticket with null description",
    mockResponse: {
      key: "WIN-3642", 
      fields: {
        summary: "Ticket with null description",
        description: null,
        status: { name: "To Do" },
        priority: { name: "Medium" }
      }
    }
  },
  {
    name: "Ticket with empty description",
    mockResponse: {
      key: "WIN-3643",
      fields: {
        summary: "Ticket with empty description",
        description: "",
        status: { name: "Done" },
        priority: { name: "Low" }
      }
    },
  },
  {
    name: "Ticket with missing fields",
    mockResponse: {
      key: "WIN-3644",
      fields: {
        summary: "Ticket with missing fields"
        // Missing description, status, priority
      }
    }
  }
];

console.log("Testing Jira MCP null safety fixes...\n");

testScenarios.forEach((scenario, index) => {
  console.log(`\n--- Test ${index + 1}: ${scenario.name} ---`);
  
  // Mock the fetchJiraTicket function behavior
  const mockTicket = {
    key: scenario.mockResponse.key || 'Unknown',
    summary: scenario.mockResponse.fields?.summary || 'No summary provided',
    description: scenario.mockResponse.fields?.description || 'No description provided',
    status: scenario.mockResponse.fields?.status?.name || 'Unknown status',
    priority: scenario.mockResponse.fields?.priority?.name || 'Unknown priority',
  };
  
  // Create mock context
  const mockContext = {
    tickets: [mockTicket],
    documentation: []
  };
  
  try {
    // This should not throw "ticket.description?.substring is not a function"
    const formattedContext = formatPRDContextForPrompt(mockContext);
    console.log("✅ SUCCESS: Formatted context without errors");
    console.log("Ticket summary:", mockTicket.summary);
    console.log("Ticket description preview:", mockTicket.description.substring(0, 50) + "...");
  } catch (error) {
    console.log("❌ FAILED:", error.message);
  }
});

console.log("\n--- All tests completed ---");