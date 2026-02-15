const axios = require('axios');
require('dotenv').config();

const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN;

async function checkTracking(trackingNumber, carrier = 'ups') {
  console.log(`\n📦 Checking tracking for: ${trackingNumber}\n`);
  
  if (!SHIPPO_API_TOKEN) {
    console.error('❌ Error: SHIPPO_API_TOKEN not found in .env file');
    console.log('Please add your Shippo API token to the .env file:');
    console.log('SHIPPO_API_TOKEN=your_token_here\n');
    return;
  }
  
  try {
    const response = await axios.get(
      `https://api.goshippo.com/tracks/${carrier}/${trackingNumber}`,
      {
        headers: {
          'Authorization': `ShippoToken ${SHIPPO_API_TOKEN}`
        }
      }
    );
    
    const data = response.data;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 TRACKING INFORMATION');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Carrier:', data.carrier);
    console.log('Tracking Number:', data.tracking_number);
    console.log('Status:', data.tracking_status.status);
    console.log('Substatus:', data.tracking_status.substatus);
    console.log('Status Date:', data.tracking_status.status_date);
    console.log('Status Details:', data.tracking_status.status_details);
    
    if (data.tracking_status.location) {
      console.log('Location:', `${data.tracking_status.location.city}, ${data.tracking_status.location.state}`);
    }
    
    if (data.eta) {
      console.log('Estimated Delivery:', data.eta);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📜 TRACKING HISTORY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (data.tracking_history && data.tracking_history.length > 0) {
      data.tracking_history.forEach((event, i) => {
        console.log(`${i + 1}. ${event.status} - ${event.status_date}`);
        console.log(`   ${event.status_details}`);
        if (event.location) {
          console.log(`   Location: ${event.location.city}, ${event.location.state}`);
        }
        console.log('');
      });
    } else {
      console.log('No tracking history available yet.\n');
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error fetching tracking information:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data?.detail || error.response.data);
    } else {
      console.error(error.message);
    }
    console.log('');
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n📦 Shippo Tracking Checker\n');
  console.log('Usage: node check-shippo-tracking.js <tracking_number> [carrier]\n');
  console.log('Examples:');
  console.log('  node check-shippo-tracking.js 1Z0Y3G510331997230');
  console.log('  node check-shippo-tracking.js 1Z0Y3G510331997230 ups');
  console.log('  node check-shippo-tracking.js 9400111899562537624747 usps\n');
  console.log('Supported carriers: ups, usps, fedex, dhl_express\n');
  process.exit(0);
}

const trackingNumber = args[0];
const carrier = args[1] || 'ups';

console.log('\n🚀 Fetching tracking information from Shippo API...\n');
checkTracking(trackingNumber, carrier);
