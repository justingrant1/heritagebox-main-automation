const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function testShippoWebhook(trackingNumber, status) {
  console.log(`\n🧪 Testing webhook for ${trackingNumber} with status ${status}\n`);
  
  const webhookData = {
    data: {
      tracking_number: trackingNumber,
      tracking_status: {
        status: status,
        substatus: status === 'DELIVERED' ? 'delivered_01' : 'in_transit_01',
        status_date: new Date().toISOString(),
        status_details: 'Package scanned at facility'
      },
      carrier: 'ups',
      tracking_history: []
    },
    event: 'track_updated',
    test: true
  };
  
  try {
    const response = await axios.post(
      `${SERVER_URL}/webhook/shippo-tracking`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test scenarios
async function runTests() {
  console.log('🚀 Starting Shippo Webhook Tests\n');
  console.log('Make sure your server is running on http://localhost:3000\n');
  
  // Test 1: Label 1 in transit (should trigger "Kit Sent")
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 1: Label 1 - Kit to Customer (TRANSIT)');
  console.log('Expected: Status change from "Pending" to "Kit Sent"');
  console.log('═══════════════════════════════════════════════════════');
  await testShippoWebhook('1Z0Y3G510331997230', 'TRANSIT');
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Label 2 delivered (should trigger "Media Received")
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Test 2: Label 2 - Customer Returning Media (DELIVERED)');
  console.log('Expected: Status change from "Kit Sent" to "Media Received"');
  console.log('═══════════════════════════════════════════════════════');
  await testShippoWebhook('1Z0Y3G510329462642', 'DELIVERED');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Label 3 in transit (should trigger "Shipping Back")
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Test 3: Label 3 - Returning Originals (TRANSIT)');
  console.log('Expected: Status change from "Quality Check" to "Shipping Back"');
  console.log('═══════════════════════════════════════════════════════');
  await testShippoWebhook('1Z0Y3G510335105258', 'TRANSIT');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Label 3 delivered (should trigger "Complete")
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Test 4: Label 3 - Originals Delivered (DELIVERED)');
  console.log('Expected: Status change from "Shipping Back" to "Complete"');
  console.log('═══════════════════════════════════════════════════════');
  await testShippoWebhook('1Z0Y3G510335105258', 'DELIVERED');
  
  console.log('\n✅ All tests completed!\n');
}

// Run tests
runTests().catch(console.error);
