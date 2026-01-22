// Test script to verify your webhooks are working
// Run this with: node test-webhooks.js

const axios = require('axios');

// Change this to your server URL
const SERVER_URL = 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

async function testHealthCheck() {
  log.info('Testing health check endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    log.success(`Health check passed: ${response.data.status}`);
    return true;
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testNewProspect() {
  log.info('Testing new prospect webhook...');
  try {
    const testData = {
      record: {
        id: 'recTEST123',
        fields: {
          'Email': 'test@example.com',
          'First Name': 'John',
          'Last Name': 'Doe',
          'Source': 'Test'
        }
      }
    };

    const response = await axios.post(`${SERVER_URL}/webhook/new-prospect`, testData);
    log.success('New prospect webhook passed');
    console.log('   Response:', response.data);
    return true;
  } catch (error) {
    log.error(`New prospect webhook failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testOrderStatusEmail() {
  log.info('Testing order status email webhook...');
  try {
    const testData = {
      record: {
        id: 'recTEST456',
        fields: {
          'Order Number': 'HB-TEST-001',
          'Customer Name': 'Jane Smith',
          'Customer Email': 'jane@example.com',
          'Ops Status': 'Pending',
          'Ops Status Key': 'PENDING'
        }
      }
    };

    const response = await axios.post(`${SERVER_URL}/webhook/order-status-changed`, testData);
    log.success('Order status email webhook passed');
    console.log('   Response:', response.data);
    return true;
  } catch (error) {
    log.error(`Order status email failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testDropboxFolder() {
  log.info('Testing Dropbox folder creation webhook...');
  try {
    const testData = {
      record: {
        id: 'recTEST789',
        fields: {
          'Customer Name': 'Bob Johnson',
          'Order Number': 'HB-TEST-002'
        }
      }
    };

    const response = await axios.post(`${SERVER_URL}/webhook/create-dropbox-folder`, testData);
    log.success('Dropbox folder creation passed');
    console.log('   Response:', response.data);
    return true;
  } catch (error) {
    log.error(`Dropbox folder creation failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(50));
  console.log('  HeritageBox Automation - Webhook Tests');
  console.log('='.repeat(50) + '\n');

  const results = {
    health: await testHealthCheck(),
    prospect: false,
    statusEmail: false,
    dropbox: false
  };

  console.log(''); // spacing

  if (results.health) {
    results.prospect = await testNewProspect();
    console.log(''); // spacing
    
    results.statusEmail = await testOrderStatusEmail();
    console.log(''); // spacing
    
    results.dropbox = await testDropboxFolder();
    console.log(''); // spacing
  }

  // Summary
  console.log('='.repeat(50));
  console.log('  Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Health Check:          ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`New Prospect:          ${results.prospect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Order Status Email:    ${results.statusEmail ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Dropbox Folder:        ${results.dropbox ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(50) + '\n');

  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    log.success('All tests passed! Your automation server is ready to go! 🎉');
  } else {
    log.warn('Some tests failed. Check your .env configuration and API keys.');
  }
}

// Run the tests
runAllTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});
