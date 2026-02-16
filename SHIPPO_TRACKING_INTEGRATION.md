# 🚢 Shippo Tracking Integration Plan

Automated order status updates based on real-time shipping events from Shippo API.

---

## 📋 Overview

This integration automatically updates order status in Airtable based on UPS tracking events received from Shippo webhooks.

### Current Shipping Workflow

Each HeritageBox order has **3 shipping labels**:

```
1️⃣ Label 1: HeritageBox → Customer (1 lb)
   Purpose: Send empty kit to customer
   Trigger: "Kit Sent" when UPS receives package
   
2️⃣ Label 2: Customer → HeritageBox (5 lb)  
   Purpose: Customer returns media to us
   Trigger: "Media Received" when delivered to HeritageBox
   
3️⃣ Label 3: HeritageBox → Customer (5 lb)
   Purpose: Return digitized originals to customer
   Trigger: "Shipping Back" when UPS picks up package
   Trigger: "Complete" when delivered to customer
```

### Airtable Fields
- `Label 1 Tracking` + `Label 1 URL`
- `Label 2 Tracking` + `Label 2 URL`
- `Label 3 Tracking` + `Label 3 URL`
- `Ops Status` - The field we'll update

---

## 🏗️ Architecture

### High-Level Flow

```
Shippo Event         Your Server           Airtable
    │                    │                    │
    │  1. Webhook        │                    │
    ├──────────────────→ │                    │
    │  (tracking update) │                    │
    │                    │                    │
    │                    │  2. Lookup Order   │
    │                    ├──────────────────→ │
    │                    │  (by tracking #)   │
    │                    │                    │
    │                    │  3. Determine      │
    │                    │     Status Change  │
    │                    │                    │
    │                    │  4. Update Status  │
    │                    ├──────────────────→ │
    │                    │                    │
    │                    │  5. Trigger Email  │
    │                    │     (existing      │
    │                    │      automation)   │
```

### Status Mapping Logic

**Shippo Handles (Automatic):**

| Label | Shippo Status | Current Ops Status | New Ops Status |
|-------|--------------|-------------------|----------------|
| Label 1 | `TRANSIT` or `IN_TRANSIT` | `Pending` | `Kit Sent` |
| Label 2 | `DELIVERED` | `Kit Sent` | `Media Received` |
| Label 3 | `TRANSIT` or `IN_TRANSIT` | `Quality Check` | `Shipping Back` |
| Label 3 | `DELIVERED` | `Shipping Back` | `Complete` |

**Employee Handles (Manual via App):**
- `Media Received` → `Digitizing` → `Quality Check`

**Email Handling:**
- Airtable automations send all emails (existing setup)
- Server only updates `Ops Status` field
- Airtable detects status change and triggers email

---

## 💻 Implementation

### Step 1: Add Environment Variables

Add to `.env`:

```env
# Shippo Configuration
SHIPPO_API_TOKEN=your_shippo_api_token_here
SHIPPO_WEBHOOK_SECRET=your_shippo_webhook_secret_here
```

### Step 2: Add Webhook Endpoint

Add to `server.js`:

```javascript
// ============================================
// SHIPPO TRACKING WEBHOOK
// ============================================

const crypto = require('crypto');

// Configuration
const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN;
const SHIPPO_WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET;

// Main webhook handler
app.post('/webhook/shippo-tracking', async (req, res) => {
  try {
    console.log('📦 Shippo tracking webhook received');
    
    // 1. Validate webhook signature (security)
    const isValid = validateShippoWebhook(req);
    if (!isValid) {
      console.error('❌ Invalid Shippo webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    // 2. Extract tracking information
    const { data } = req.body;
    const trackingNumber = data.tracking_number;
    const trackingStatus = data.tracking_status.status;
    const trackingSubstatus = data.tracking_status.substatus;
    const statusDate = data.tracking_status.status_date;
    
    console.log(`📍 Tracking Update: ${trackingNumber} → ${trackingStatus}`);
    console.log(`   Substatus: ${trackingSubstatus}`);
    console.log(`   Date: ${statusDate}`);
    
    // 3. Find order by tracking number
    const order = await findOrderByTracking(trackingNumber);
    if (!order) {
      console.log(`⚠️  No order found for tracking: ${trackingNumber}`);
      return res.json({ success: true, message: 'No order found' });
    }
    
    const orderNumber = order.fields['Order Number'] || order.id;
    console.log(`✅ Found order: ${orderNumber}`);
    
    // 4. Determine new status based on which label and current status
    const newOpsStatus = determineNewStatus(order, trackingNumber, trackingStatus);
    if (!newOpsStatus) {
      console.log(`ℹ️  No status change needed for ${orderNumber}`);
      return res.json({ 
        success: true, 
        message: 'No status change needed',
        order: orderNumber,
        currentStatus: order.fields['Ops Status']
      });
    }
    
    // 5. Check if this is a valid transition
    const currentStatus = order.fields['Ops Status'];
    if (!isValidTransition(currentStatus, newOpsStatus)) {
      console.warn(`⚠️  Invalid transition: ${currentStatus} → ${newOpsStatus}`);
      return res.json({
        success: false,
        message: 'Invalid status transition',
        order: orderNumber,
        currentStatus: currentStatus,
        attemptedStatus: newOpsStatus
      });
    }
    
    // 6. Update Airtable
    await updateOrderStatus(order.id, newOpsStatus);
    
    // 7. The existing Airtable automation will trigger and send email!
    console.log(`✅ Updated order ${orderNumber}: ${currentStatus} → ${newOpsStatus}`);
    
    res.json({ 
      success: true, 
      order: orderNumber,
      previousStatus: currentStatus,
      newStatus: newOpsStatus,
      trackingNumber: trackingNumber
    });
    
  } catch (error) {
    console.error('❌ Shippo webhook error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Helper: Find order by tracking number (checks all 3 labels)
async function findOrderByTracking(trackingNumber) {
  try {
    // Search using Airtable API formula
    const formula = `OR(
      {Label 1 Tracking} = '${trackingNumber}',
      {Label 2 Tracking} = '${trackingNumber}',
      {Label 3 Tracking} = '${trackingNumber}'
    )`;
    
    const response = await airtableRequest(
      `Orders?filterByFormula=${encodeURIComponent(formula)}`,
      'GET'
    );
    
    if (response.records && response.records.length > 0) {
      return response.records[0];
    }
    
    return null;
      
  } catch (error) {
    console.error('Error finding order by tracking:', error);
    throw error;
  }
}

// Helper: Determine what status change to make (STATUS-AWARE - handles label swaps)
function determineNewStatus(order, trackingNumber, shippoStatus) {
  const currentStatus = order.fields['Ops Status'];
  
  console.log(`   Current Status: ${currentStatus}`);
  console.log(`   Shippo Status: ${shippoStatus}`);
  
  // Determine which field has this tracking number (for logging only)
  let labelField = 'Unknown';
  if (trackingNumber === order.fields['Label 1 Tracking']) labelField = 'Label 1';
  else if (trackingNumber === order.fields['Label 2 Tracking']) labelField = 'Label 2';
  else if (trackingNumber === order.fields['Label 3 Tracking']) labelField = 'Label 3';
  console.log(`   Tracking found in: ${labelField}`);
  
  // Use ORDER STATUS to determine what this event actually means
  // This handles cases where Label 1 and Label 3 are accidentally swapped
  
  // TRANSIT/IN_TRANSIT events (PRE_TRANSIT removed - only trigger on actual carrier scan)
  if (['TRANSIT', 'IN_TRANSIT'].includes(shippoStatus)) {
    
    // If order is Pending → This must be the KIT going out (Label 1 intent)
    if (currentStatus === 'Pending') {
      console.log(`   → Detected: Kit shipping to customer`);
      return 'Kit Sent';
    }
    
    // If order is Quality Check/Digitizing → This must be ORIGINALS going back (Label 3 intent)
    if (['Quality Check', 'Digitizing'].includes(currentStatus)) {
      console.log(`   → Detected: Originals shipping back to customer`);
      return 'Shipping Back';
    }
  }
  
  // DELIVERED events
  if (shippoStatus === 'DELIVERED') {
    
    // If order is Kit Sent → This must be MEDIA being delivered to us (Label 2)
    if (currentStatus === 'Kit Sent') {
      console.log(`   → Detected: Media delivered to HeritageBox`);
      return 'Media Received';
    }
    
    // If order is Shipping Back → This must be ORIGINALS delivered to customer (Label 3)
    if (currentStatus === 'Shipping Back') {
      console.log(`   → Detected: Originals delivered to customer`);
      return 'Complete';
    }
  }
  
  console.log(`   → No status change needed for current state`);
  return null; // No change needed
}

// Helper: Update order status in Airtable
async function updateOrderStatus(recordId, newStatus) {
  try {
    await airtableRequest(`Orders/${recordId}`, 'PATCH', {
      fields: {
        'Ops Status': newStatus
      }
    });
    console.log(`✅ Airtable updated: ${recordId} → ${newStatus}`);
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

// Helper: Validate Shippo webhook signature
function validateShippoWebhook(req) {
  // Shippo signs webhooks with HMAC-SHA256
  // See: https://goshippo.com/docs/webhooks#webhook-security
  
  if (!SHIPPO_WEBHOOK_SECRET) {
    console.warn('⚠️  No SHIPPO_WEBHOOK_SECRET configured - skipping validation');
    return true; // Skip validation in development
  }
  
  const signature = req.headers['x-shippo-signature'];
  if (!signature) {
    console.error('❌ No signature header found');
    return false;
  }
  
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SHIPPO_WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');
  
  const isValid = signature === digest;
  console.log(`🔐 Signature validation: ${isValid ? 'PASS' : 'FAIL'}`);
  
  return isValid;
}

// Helper: Check if status transition is valid (Shippo-triggered only)
function isValidTransition(currentStatus, newStatus) {
  // Only validate transitions that Shippo webhooks can trigger
  // Employee manually handles: Media Received → Digitizing → Quality Check
  const validTransitions = {
    'Pending': ['Kit Sent'],
    'Kit Sent': ['Media Received'],
    'Quality Check': ['Shipping Back'],
    'Shipping Back': ['Complete']
  };
  
  const allowed = validTransitions[currentStatus];
  return allowed && allowed.includes(newStatus);
}
```

### Step 3: Register Webhook with Shippo

#### Option A: Via Shippo Dashboard (Recommended)

1. Go to https://goshippo.com/user/apikeys/
2. Navigate to "Webhooks" section
3. Click "Add Webhook"
4. Configure:
   - **URL:** `https://your-server.com/webhook/shippo-tracking`
   - **Events:** Select "Track Updated" (`track_updated`)
   - **Active:** Yes
5. Save and copy the **Webhook Secret**
6. Add secret to your `.env` file as `SHIPPO_WEBHOOK_SECRET`

#### Option B: Via API

```bash
curl https://api.goshippo.com/webhooks/ \
  -H "Authorization: ShippoToken YOUR_SHIPPO_API_TOKEN" \
  -d url="https://your-server.com/webhook/shippo-tracking" \
  -d event="track_updated" \
  -d active=true
```

---

## 🧪 Testing

### Test 1: Simulate Shippo Webhook Locally

Create `test-shippo-webhook.js`:

```javascript
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
  // Test 1: Label 1 in transit (should trigger "Kit Sent")
  await testShippoWebhook('1Z0Y3G510331997230', 'TRANSIT');
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Label 2 delivered (should trigger "Media Received")
  await testShippoWebhook('1Z0Y3G510329462642', 'DELIVERED');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Label 3 in transit (should trigger "Shipping Back")
  await testShippoWebhook('1Z0Y3G510335105258', 'TRANSIT');
}

// Run tests
runTests().catch(console.error);
```

Run with:
```bash
node test-shippo-webhook.js
```

### Test 2: Check Real Tracking Status

Create `check-shippo-tracking.js`:

```javascript
const axios = require('axios');
require('dotenv').config();

const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN;

async function checkTracking(trackingNumber, carrier = 'ups') {
  console.log(`\n📦 Checking tracking for: ${trackingNumber}\n`);
  
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
    
    console.log('Carrier:', data.carrier);
    console.log('Tracking Number:', data.tracking_number);
    console.log('Status:', data.tracking_status.status);
    console.log('Substatus:', data.tracking_status.substatus);
    console.log('Status Date:', data.tracking_status.status_date);
    console.log('Location:', data.tracking_status.location);
    console.log('\nTracking History:');
    
    data.tracking_history.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.status} - ${event.status_date}`);
      console.log(`     ${event.status_details}`);
      console.log(`     ${event.location.city}, ${event.location.state}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Check a tracking number
const trackingNumber = process.argv[2] || '1Z0Y3G510331997230';
checkTracking(trackingNumber);
```

Run with:
```bash
node check-shippo-tracking.js 1Z0Y3G510331997230
```

---

## 📊 Shippo Status Reference

### Shippo Tracking Statuses

| Status | Description | When It Occurs |
|--------|-------------|----------------|
| `UNKNOWN` | Shipment info received | Label created, no scan yet |
| `PRE_TRANSIT` | Label created, awaiting pickup | After label creation |
| `TRANSIT` / `IN_TRANSIT` | Package in transit | Package scanned and moving |
| `DELIVERED` | Package delivered | Delivered to recipient |
| `RETURNED` | Package returned to sender | Delivery failed, returning |
| `FAILURE` | Delivery failed | Could not deliver |
| `CANCELLED` | Shipment cancelled | Cancelled before pickup |

### Our Status Mapping

```javascript
// Shippo Automatic Transitions:
Label 1: TRANSIT → "Kit Sent" (from Pending)
Label 2: DELIVERED → "Media Received" (from Kit Sent)
Label 3: TRANSIT → "Shipping Back" (from Quality Check)
Label 3: DELIVERED → "Complete" (from Shipping Back)

// Employee Manual Transitions (via app):
Media Received → Digitizing → Quality Check
```

---

## 🚨 Error Handling

### Common Issues & Solutions

#### Issue 1: Webhook Not Receiving Events

**Symptoms:**
- No logs showing webhook calls
- Orders not updating automatically

**Solutions:**
1. Check webhook is registered in Shippo dashboard
2. Verify webhook URL is publicly accessible (not localhost)
3. Check server logs for errors
4. Test with `curl` to your webhook endpoint

#### Issue 2: Invalid Signature Errors

**Symptoms:**
- Logs show "Invalid Shippo webhook signature"

**Solutions:**
1. Verify `SHIPPO_WEBHOOK_SECRET` in `.env` matches Shippo dashboard
2. Check webhook secret hasn't been regenerated
3. Temporarily disable validation for testing (not in production!)

#### Issue 3: Order Not Found

**Symptoms:**
- Logs show "No order found for tracking: XXX"

**Solutions:**
1. Verify tracking number is saved in Airtable
2. Check tracking number format (no extra spaces)
3. Verify Airtable API key has read permissions

#### Issue 4: Status Not Updating

**Symptoms:**
- Webhook receives event but status doesn't change

**Solutions:**
1. Check current status allows the transition
2. Verify Airtable API key has write permissions
3. Check Airtable field name is exactly "Ops Status"
4. Review status determination logic

---

## 🔐 Security Considerations

### 1. Webhook Signature Validation

Always validate webhook signatures in production:

```javascript
if (!SHIPPO_WEBHOOK_SECRET) {
  throw new Error('SHIPPO_WEBHOOK_SECRET is required in production');
}
```

### 2. Rate Limiting

Add rate limiting to webhook endpoint:

```javascript
const rateLimit = require('express-rate-limit');

const shippoLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many webhook requests'
});

app.post('/webhook/shippo-tracking', shippoLimiter, async (req, res) => {
  // ... handler code
});
```

### 3. Idempotency

Prevent duplicate processing:

```javascript
const processedWebhooks = new Set();

// In webhook handler:
const webhookId = req.body.id || `${trackingNumber}-${statusDate}`;
if (processedWebhooks.has(webhookId)) {
  console.log(`⚠️  Duplicate webhook: ${webhookId}`);
  return res.json({ success: true, message: 'Already processed' });
}
processedWebhooks.add(webhookId);

// Clean up old entries periodically
setTimeout(() => processedWebhooks.delete(webhookId), 3600000); // 1 hour
```

---

## 📈 Monitoring & Logging

### Enhanced Logging

Add structured logging:

```javascript
function logTrackingEvent(level, message, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    ...data
  };
  
  console.log(JSON.stringify(logEntry));
  
  // Optional: Send to logging service (Datadog, LogRocket, etc.)
}

// Usage:
logTrackingEvent('info', 'Tracking update received', {
  trackingNumber: trackingNumber,
  status: trackingStatus,
  orderNumber: orderNumber
});
```

### Metrics to Track

1. **Webhook Success Rate**
   - Total webhooks received
   - Successfully processed
   - Failed/errored

2. **Status Update Latency**
   - Time from Shippo event to Airtable update
   - Average: should be < 5 seconds

3. **Order Status Distribution**
   - How many orders in each status
   - Identify bottlenecks

4. **Failed Transitions**
   - Track invalid status transitions
   - May indicate workflow issues

---

## 🎯 Future Enhancements

### Phase 2 Features

1. **Tracking Dashboard**
   ```javascript
   app.get('/admin/tracking-dashboard', async (req, res) => {
     // Show all orders with tracking status
     // Highlight any issues or delays
   });
   ```

2. **Manual Refresh**
   ```javascript
   app.post('/admin/refresh-tracking/:orderId', async (req, res) => {
     // Manually poll Shippo for latest status
     // Useful for backfilling or debugging
   });
   ```

3. **Anomaly Detection**
   - Alert if package stuck in transit > 7 days
   - Alert if Label 2 delivered but Label 1 never scanned
   - Alert on delivery failures

4. **Customer Tracking Portal**
   - Public page where customers can check status
   - Shows estimated delivery dates
   - Links to carrier tracking

5. **SMS Notifications**
   - Send SMS when kit ships
   - Send SMS when media received
   - Send SMS when originals ship back

---

## 📋 Deployment Checklist

Before going live:

- [ ] Add `SHIPPO_API_TOKEN` to production `.env`
- [ ] Add `SHIPPO_WEBHOOK_SECRET` to production `.env`
- [ ] Deploy updated `server.js` to production
- [ ] Register webhook in Shippo dashboard with production URL
- [ ] Test webhook with real tracking number
- [ ] Verify Airtable updates correctly
- [ ] Verify emails are sent (via existing automation)
- [ ] Monitor logs for first 24 hours
- [ ] Set up error alerting
- [ ] Document any issues encountered

---

## 🆘 Support & Troubleshooting

### Debug Mode

Enable verbose logging:

```javascript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Full webhook payload:', JSON.stringify(req.body, null, 2));
  console.log('Order data:', JSON.stringify(order, null, 2));
}
```

### Useful Commands

```bash
# Check if webhook endpoint is accessible
curl -X POST https://your-server.com/webhook/shippo-tracking \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# View recent Shippo webhooks
curl https://api.goshippo.com/webhooks/ \
  -H "Authorization: ShippoToken YOUR_TOKEN"

# Check tracking status
curl https://api.goshippo.com/tracks/ups/TRACKING_NUMBER \
  -H "Authorization: ShippoToken YOUR_TOKEN"
```

### Contact

- **Shippo Support:** https://support.goshippo.com/
- **Shippo API Docs:** https://goshippo.com/docs/
- **Airtable API Docs:** https://airtable.com/developers/web/api/introduction

---

## 📚 Additional Resources

- [Shippo Webhooks Documentation](https://goshippo.com/docs/webhooks)
- [Shippo Tracking API](https://goshippo.com/docs/tracking)
- [Airtable API Reference](https://airtable.com/developers/web/api/introduction)
- [UPS Tracking Status Codes](https://www.ups.com/us/en/support/tracking-support/tracking-status-codes.page)

---

**Last Updated:** February 14, 2026  
**Version:** 1.0  
**Author:** HeritageBox Automation Team
