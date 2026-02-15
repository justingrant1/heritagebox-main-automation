const axios = require('axios');

// Your Railway production URL
const WEBHOOK_URL = 'https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking';

// Simulate a Shippo webhook for Label 1 (Kit to Customer) - TRANSIT status
const testData = {
  data: {
    tracking_number: '1Z0Y3G510331997230', // Real tracking number from your Airtable
    tracking_status: {
      status: 'TRANSIT',
      substatus: 'in_transit_01',
      status_date: new Date().toISOString(),
      status_details: 'Package is in transit',
      location: {
        city: 'Louisville',
        state: 'KY',
        zip: '40213',
        country: 'US'
      }
    },
    carrier: 'ups',
    tracking_history: [
      {
        status: 'TRANSIT',
        status_date: new Date().toISOString(),
        status_details: 'Package scanned at UPS facility',
        location: {
          city: 'Louisville',
          state: 'KY'
        }
      }
    ]
  },
  event: 'track_updated',
  test: true
};

console.log('\n🧪 Testing Shippo Webhook Integration\n');
console.log('═══════════════════════════════════════════════════════');
console.log('Webhook URL:', WEBHOOK_URL);
console.log('Tracking Number:', testData.data.tracking_number);
console.log('Status:', testData.data.tracking_status.status);
console.log('Expected Result: Status change from "Pending" to "Kit Sent"');
console.log('═══════════════════════════════════════════════════════\n');

async function testWebhook() {
  try {
    console.log('📤 Sending webhook request...\n');
    
    const response = await axios.post(WEBHOOK_URL, testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ SUCCESS! Response from server:\n');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n═══════════════════════════════════════════════════════');
    
    if (response.data.success) {
      console.log('✅ Webhook processed successfully!');
      if (response.data.newStatus) {
        console.log(`✅ Order status updated: ${response.data.previousStatus} → ${response.data.newStatus}`);
        console.log('✅ Check Airtable to verify the status change!');
      } else if (response.data.message === 'No status change needed') {
        console.log('ℹ️  Order is not in the correct status for this transition');
        console.log('   Current status:', response.data.currentStatus);
        console.log('   This webhook would trigger when status is "Pending"');
      }
    } else {
      console.log('⚠️  Webhook received but no action taken');
      console.log('   Reason:', response.data.message);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.log('\n💡 This is expected if SHIPPO_WEBHOOK_SECRET is not set in Railway');
        console.log('   The endpoint is working, but signature validation failed');
        console.log('   To fix: Add SHIPPO_WEBHOOK_SECRET to Railway environment variables');
      }
    } else {
      console.error(error.message);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
}

testWebhook();
