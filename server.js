require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Dropbox } = require('dropbox');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(express.json());

// Configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const PORT = process.env.PORT || 3000;

sgMail.setApiKey(SENDGRID_API_KEY);
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });

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
    
    console.log(`📧 Enrolling ${email} in marketing automation...`);
    console.log(`Source: ${source}`);

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

    const customerName = record.fields['Customer Name'];
    const orderNumber = record.fields['Order Number'] || 'Unknown';
    const recordId = record.id;
    
    // Create folder name: "FirstName LastName - OrderNumber"
    const folderName = `${customerName} - ${orderNumber}`;
    const folderPath = `/${folderName}`;
    
    console.log(`📁 Creating Dropbox folder: ${folderPath}`);

    // Create folder in Dropbox
    await dbx.filesCreateFolderV2({
      path: folderPath,
      autorename: true // In case folder already exists
    });

    console.log(`✅ Folder created: ${folderPath}`);

    // Create shared link
    const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: folderPath,
      settings: {
        requested_visibility: 'public'
      }
    });

    const dropboxLink = sharedLinkResponse.result.url;
    console.log(`🔗 Shared link created: ${dropboxLink}`);

    // Update Airtable record with Dropbox link
    await airtableRequest(`Orders/${recordId}`, 'PATCH', {
      fields: {
        'Dropbox Link': dropboxLink
      }
    });

    console.log(`✅ Airtable updated with Dropbox link`);
    
    res.json({ 
      success: true, 
      folderPath,
      dropboxLink 
    });
  } catch (error) {
    console.error('❌ Error creating Dropbox folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint - Shows API info
app.get('/', (req, res) => {
  res.json({
    name: 'HeritageBox Automation Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      webhooks: [
        'POST /webhook/new-prospect',
        'POST /webhook/order-status-changed',
        'POST /webhook/create-dropbox-folder'
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
});
