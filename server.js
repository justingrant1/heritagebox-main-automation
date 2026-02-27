require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Dropbox } = require('dropbox');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(express.json());

// Configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN;
const SHIPPO_WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;

sgMail.setApiKey(SENDGRID_API_KEY);

// Dropbox token refresh helper
async function getDropboxAccessToken() {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to refresh Dropbox token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

// Airtable helper
const airtableRequest = async (endpoint, method = 'GET', data = null) => {
  const config = {
    method,
    url: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) config.data = data;
  
  const response = await axios(config);
  return response.data;
};

// ============================================
// AUTOMATION 1: SendGrid Marketing Enrollment
// ============================================
app.post('/webhook/new-prospect', async (req, res) => {
  try {
    const { record } = req.body;
    
    if (!record || !record.fields.Email) {
      return res.status(400).json({ error: 'Missing email field' });
    }

    const email = record.fields.Email;
    const firstName = record.fields['First Name'] || '';
    const lastName = record.fields['Last Name'] || '';
    const source = record.fields.Source || 'Unknown';
    const name = record.fields.Name || `${firstName} ${lastName}`.trim() || 'Unknown';
    const phone = record.fields.Phone;
    const inquiryType = record.fields['Inquiry Type'];
    const mediaTypes = record.fields['Media Types'];
    const quantity = record.fields['Quantity'];
    const notes = record.fields.Notes || record.fields.Message || record.fields['Customer Message'];
    const chatTranscript = record.fields['Chat Transcript'] || record.fields['Chat Transcript (from form)'];
    
    console.log(`📧 Enrolling ${email} in marketing automation...`);
    console.log(`Source: ${source}`);

    if (source === 'Contact Form') {
      const subjectSuffix = inquiryType ? ` - ${inquiryType}` : '';
      const subject = `Heritage Box Customer Service${subjectSuffix}`;

      const detailRows = [
        { label: 'Name', value: name },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Inquiry Type', value: inquiryType },
        { label: 'Media Types', value: mediaTypes },
        { label: 'Quantity', value: quantity }
      ]
        .filter((row) => row.value)
        .map(
          (row) => `
            <tr>
              <td style="padding:4px 8px; font-weight:bold;">${row.label}:</td>
              <td style="padding:4px 8px;">${row.value}</td>
            </tr>`
        )
        .join('');

      const messageBlocks = [
        notes ? `<p style="margin:0 0 12px;"><strong>Message:</strong><br/>${notes}</p>` : '',
        chatTranscript
          ? `<p style="margin:0 0 12px;"><strong>Chat Transcript:</strong><br/>${chatTranscript}</p>`
          : ''
      ].join('');

      const notificationHtml = `
        <p>You received a new contact form inquiry.</p>
        <table style="border-collapse:collapse;">
          ${detailRows}
        </table>
        ${messageBlocks || '<p>No message provided.</p>'}
      `;

      const notification = {
        to: 'info@heritagebox.com',
        from: process.env.SENDGRID_FROM_EMAIL,
        replyTo: email,
        subject,
        html: notificationHtml
      };

      await sgMail.send(notification);
      console.log(`✅ Contact form forwarded to info@heritagebox.com for ${email}`);
    }

    // Check if SENDGRID_LIST_ID is configured
    if (!process.env.SENDGRID_LIST_ID) {
      console.warn('⚠️  SENDGRID_LIST_ID not configured - contact will not be added to list');
      return res.json({ 
        success: true, 
        warning: 'SENDGRID_LIST_ID not configured',
        email 
      });
    }

    // Add contact to SendGrid Marketing list (simplified - no custom fields)
    const contactData = {
      list_ids: [process.env.SENDGRID_LIST_ID],
      contacts: [
        {
          email: email,
          first_name: firstName,
          last_name: lastName
        }
      ]
    };

    console.log('SendGrid request:', JSON.stringify(contactData, null, 2));

    const response = await axios.put(
      'https://api.sendgrid.com/v3/marketing/contacts',
      contactData,
      {
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Successfully enrolled ${email}`);
    console.log('SendGrid response:', response.data);
    
    res.json({ success: true, email, sendgridResponse: response.data });
  } catch (error) {
    console.error('❌ Error enrolling prospect:', error.response?.data || error.message);
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data
    });
  }
});

// ============================================
// AUTOMATION 2: Order Status Update Emails
// ============================================
app.post('/webhook/order-status-changed', async (req, res) => {
  try {
    const { record } = req.body;
    
    if (!record || !record.fields['Customer Email']) {
      return res.status(400).json({ error: 'Missing customer email' });
    }

    const opsStatus = record.fields['Ops Status'];
    const opsStatusKey = record.fields['Ops Status Key'];
    const customerEmail = record.fields['Customer Email'];
    const customerName = record.fields['Customer Name'] || 'Valued Customer';
    const orderNumber = record.fields['Order Number'] || 'N/A';
    const dropboxLink = record.fields['Dropbox Link'];
    const activeTrackingNumber = record.fields['Active Tracking Number'];
    const trackingUrl = activeTrackingNumber
      ? `https://www.ups.com/track?tracknum=${encodeURIComponent(activeTrackingNumber)}`
      : null;

    console.log(`📨 Sending status update email for order ${orderNumber} - Status: ${opsStatus}`);

    // Email templates based on status
    const emailTemplates = {
      'PENDING': {
        subject: `Order ${orderNumber} - We've Received Your Order!`,
        html: `
          <h2>Thank you for your order, ${customerName}!</h2>
          <p>We've received your order <strong>${orderNumber}</strong> and are preparing your Heritage Box kit.</p>
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>We'll send you a Heritage Box kit in the mail</li>
            <li>When you receive it, fill it with your precious memories</li>
            <li>Send it back to us using the prepaid label</li>
          </ul>
          <p>Questions? Just reply to this email!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'KIT_SENT': {
        subject: `Order ${orderNumber} - Your Kit is On The Way! 📦`,
        html: `
          <h2>Great news, ${customerName}!</h2>
          <p>Your Heritage Box kit for order <strong>${orderNumber}</strong> has been shipped!</p>
          ${activeTrackingNumber ? `
            <p><strong>Tracking Number:</strong> ${activeTrackingNumber}</p>
            <p>
              <a
                href="${trackingUrl}"
                style="display:inline-block;background-color:#351c75;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;"
              >Track on UPS</a>
            </p>
          ` : ''}
          <p><strong>What to do when it arrives:</strong></p>
          <ol>
            <li>Carefully pack your photos, videos, and memorabilia</li>
            <li>Use the included prepaid shipping label</li>
            <li>Send it back to us - we'll handle the rest!</li>
          </ol>
          <p>We can't wait to digitize your memories!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'MEDIA_RECEIVED': {
        subject: `Order ${orderNumber} - We've Received Your Memories! 📸`,
        html: `
          <h2>Perfect, ${customerName}!</h2>
          <p>We've received your Heritage Box for order <strong>${orderNumber}</strong>.</p>
          <p>Our team is now carefully cataloging your items and will begin the digitization process soon.</p>
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Quality check of all materials</li>
            <li>Professional digitization</li>
            <li>Quality control review</li>
            <li>Safe return of your originals</li>
          </ul>
          <p>We'll keep you updated throughout the process!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'DIGITIZING': {
        subject: `Order ${orderNumber} - Digitization In Progress 🎬`,
        html: `
          <h2>Hi ${customerName},</h2>
          <p>Great news! We're currently digitizing your memories for order <strong>${orderNumber}</strong>.</p>
          <p>Our specialists are working carefully to preserve every detail of your precious items.</p>
          <p>You'll receive another update once we move to quality check!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'QUALITY_CHECK': {
        subject: `Order ${orderNumber} - Quality Review Underway ✓`,
        html: `
          <h2>Hi ${customerName},</h2>
          <p>Your digitized files for order <strong>${orderNumber}</strong> are now in quality review.</p>
          <p>We're ensuring every photo and video meets our high standards before delivery.</p>
          <p>Almost done!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'SHIPPING_BACK': {
        subject: `Order ${orderNumber} - Your Originals Are Coming Home! 📦`,
        html: `
          <h2>Hi ${customerName},</h2>
          <p>We've carefully packaged your original items and they're heading back to you!</p>
          <p>Order <strong>${orderNumber}</strong> is on its way.</p>
          ${activeTrackingNumber ? `
            <p><strong>Tracking Number:</strong> ${activeTrackingNumber}</p>
            <p>
              <a
                href="${trackingUrl}"
                style="display:inline-block;background-color:#351c75;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;"
              >Track on UPS</a>
            </p>
          ` : ''}
          <p>You'll receive your digital files very soon!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'COMPLETE': {
        subject: `Order ${orderNumber} - Your Digital Memories Are Ready! 🎉`,
        html: `
          <h2>Congratulations, ${customerName}!</h2>
          <p>Your order <strong>${orderNumber}</strong> is complete!</p>
          ${dropboxLink ? `
            <p><strong>Access your digitized memories here:</strong></p>
            <p><a href="${dropboxLink}" style="display:inline-block;background-color:#0061ff;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;">View Your Files</a></p>
          ` : ''}
          <p><strong>What you'll find:</strong></p>
          <ul>
            <li>High-quality scans of all your photos</li>
            <li>Digitized videos in modern formats</li>
            <li>Organized folders for easy browsing</li>
          </ul>
          <p>Your original items should arrive back to you soon if they haven't already.</p>
          <p>Thank you for trusting us with your precious memories!</p>
          <p>— The Heritage Box Team</p>
        `
      },
      'CANCELED': {
        subject: `Order ${orderNumber} - Order Canceled`,
        html: `
          <h2>Hi ${customerName},</h2>
          <p>Your order <strong>${orderNumber}</strong> has been canceled.</p>
          <p>If you have any questions or if this was done in error, please don't hesitate to reach out.</p>
          <p>— The Heritage Box Team</p>
        `
      }
    };

    const template = emailTemplates[opsStatusKey];
    
    if (!template) {
      console.log(`⚠️  No email template for status: ${opsStatusKey}`);
      return res.json({ success: true, message: 'No email template for this status' });
    }

    // Send email via SendGrid
    const msg = {
      to: customerEmail,
      from: process.env.SENDGRID_FROM_EMAIL, // You'll set this in .env
      subject: template.subject,
      html: template.html
    };

    await sgMail.send(msg);
    
    console.log(`✅ Status update email sent to ${customerEmail}`);
    
    res.json({ success: true, status: opsStatus });
  } catch (error) {
    console.error('❌ Error sending status email:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUTOMATION 3: Dropbox Folder Creation
// ============================================
app.post('/webhook/create-dropbox-folder', async (req, res) => {
  try {
    const { record } = req.body;
    
    if (!record || !record.fields['Customer Name']) {
      return res.status(400).json({ error: 'Missing customer name' });
    }

    // Check if Dropbox refresh token is configured
    if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
      console.error('⚠️  Dropbox credentials not configured');
      return res.status(500).json({ 
        error: 'Dropbox credentials not configured in environment variables' 
      });
    }

    const customerName = record.fields['Customer Name'];
    const orderNumber = record.fields['Order Number'] || 'Unknown';
    const recordId = record.id;
    
    // Create folder name: "FirstName LastName - OrderNumber"
    const folderName = `${customerName} - ${orderNumber}`;
    const folderPath = `/HeritageboxClientFiles/${folderName}`;
    
    console.log(`📁 Creating Dropbox folder: ${folderPath}`);
    console.log(`Customer: ${customerName}, Order: ${orderNumber}`);

    // Get fresh access token and create Dropbox client
    const accessToken = await getDropboxAccessToken();
    const dbx = new Dropbox({ accessToken });

    // Create folder in Dropbox
    try {
      await dbx.filesCreateFolderV2({
        path: folderPath,
        autorename: true // In case folder already exists
      });
      console.log(`✅ Folder created: ${folderPath}`);
    } catch (dropboxError) {
      console.error('Dropbox folder creation error:', dropboxError.error || dropboxError);
      throw new Error(`Dropbox folder creation failed: ${dropboxError.error?.error_summary || dropboxError.message}`);
    }

    // Create shared link
    let dropboxLink;
    try {
      const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: folderPath,
        settings: {
          requested_visibility: 'public'
        }
      });
      dropboxLink = sharedLinkResponse.result.url;
      console.log(`🔗 Shared link created: ${dropboxLink}`);
    } catch (linkError) {
      // If shared link already exists, retrieve the existing one
      if (linkError?.error?.error_summary?.includes('shared_link_already_exists')) {
        console.log('🔗 Shared link already exists, retrieving...');
        const existingLinks = await dbx.sharingListSharedLinks({
          path: folderPath,
          direct_only: true
        });
        if (existingLinks.result.links.length > 0) {
          dropboxLink = existingLinks.result.links[0].url;
          console.log(`🔗 Found existing link: ${dropboxLink}`);
        }
      } else {
        console.error('Dropbox shared link error:', linkError.error || linkError);
        throw new Error(`Dropbox shared link failed: ${linkError.error?.error_summary || linkError.message}`);
      }
    }

    // Update Airtable record with Dropbox link
    try {
      await airtableRequest(`Orders/${recordId}`, 'PATCH', {
        fields: {
          'Dropbox Link': dropboxLink
        }
      });
      console.log(`✅ Airtable updated with Dropbox link`);
    } catch (airtableError) {
      console.error('Airtable update error:', airtableError);
      // Don't fail the whole operation if Airtable update fails
      console.warn('⚠️  Could not update Airtable, but folder was created');
    }
    
    res.json({ 
      success: true, 
      folderPath,
      dropboxLink 
    });
  } catch (error) {
    console.error('❌ Error in Dropbox automation:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.error || 'See server logs for details'
    });
  }
});

// ============================================
// AUTOMATION 4: Shippo Tracking Webhook
// ============================================

// Helper: Find order by tracking number (checks all 3 labels)
async function findOrderByTracking(trackingNumber) {
  try {
    // Search using Airtable API formula
    const formula = `OR({Label 1 Tracking}='${trackingNumber}',{Label 2 Tracking}='${trackingNumber}',{Label 3 Tracking}='${trackingNumber}')`;
    
    const response = await airtableRequest(
      `Orders?filterByFormula=${encodeURIComponent(formula)}`,
      'GET'
    );
    
    if (response.records && response.records.length > 0) {
      return response.records[0];
    }
    
    return null;
      
  } catch (error) {
    console.error('Error finding order by tracking:', error.message, error.response?.data);
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
  
  // TRANSIT events - only trigger on actual carrier scan
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
      const label2Tracking = order.fields['Label 2 Tracking'];
      if (trackingNumber === label2Tracking) {
        console.log(`   → Detected: Media delivered to HeritageBox (Label 2)`);
        return 'Media Received';
      }
      console.log(`   → DELIVERED on non-Label-2 tracking while Kit Sent - ignoring`);
      return null;
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
async function updateOrderStatus(recordId, newStatus, trackingNumber = null) {
  try {
    const fields = {
      'Ops Status': newStatus
    };

    if (trackingNumber) {
      fields['Active Tracking Number'] = trackingNumber;
    }

    await airtableRequest(`Orders/${recordId}`, 'PATCH', {
      fields
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
    await updateOrderStatus(order.id, newOpsStatus, trackingNumber);
    
    // 7. Airtable automation will detect the change and send email
    console.log(`✅ Updated order ${orderNumber}: ${currentStatus} → ${newOpsStatus}`);
    console.log(`📧 Airtable automation will send email notification`);
    
    res.json({ 
      success: true, 
      order: orderNumber,
      previousStatus: currentStatus,
      newStatus: newOpsStatus,
      trackingNumber: trackingNumber
    });
    
  } catch (error) {
    console.error('❌ Shippo webhook error:', error.message, error.response?.data);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Root endpoint - Shows API info
app.get('/', (req, res) => {
  res.json({
    name: 'HeritageBox Automation Server',
    version: '1.1.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      webhooks: [
        'POST /webhook/new-prospect',
        'POST /webhook/order-status-changed',
        'POST /webhook/create-dropbox-folder',
        'POST /webhook/shippo-tracking'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 HeritageBox Automation Server running on port ${PORT}`);
  console.log(`📍 Webhook endpoints:`);
  console.log(`   - POST /webhook/new-prospect`);
  console.log(`   - POST /webhook/order-status-changed`);
  console.log(`   - POST /webhook/create-dropbox-folder`);
  console.log(`   - POST /webhook/shippo-tracking`);
});
