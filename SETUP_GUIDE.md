# HeritageBox Automation Setup Guide

This automation service handles three key workflows for your HeritageBox Airtable base:

1. **Marketing Email Enrollment** - Automatically adds new prospects to SendGrid marketing
2. **Order Status Emails** - Sends customer emails when order status changes
3. **Dropbox Folder Creation** - Creates customer folders and saves links to Airtable

## Prerequisites

Before starting, you'll need:
- Node.js installed (v16 or higher)
- Airtable API key and Base ID
- SendGrid account with API key
- Dropbox account with API access token

---

## Step 1: Get Your API Keys

### Airtable
1. Go to https://airtable.com/create/tokens
2. Click "Create token"
3. Give it a name: "HeritageBox Automation"
4. Add these scopes:
   - `data.records:read`
   - `data.records:write`
5. Add access to your HBOX2 base
6. Copy the token - this is your `AIRTABLE_API_KEY`
7. Your Base ID is in the URL: `airtable.com/app___________` (starts with "app")

### SendGrid
1. Go to https://app.sendgrid.com/settings/api_keys
2. Click "Create API Key"
3. Choose "Full Access"
4. Copy the key - this is your `SENDGRID_API_KEY`

**Create a Marketing List:**
1. Go to https://app.sendgrid.com/marketing/contacts
2. Click "Create New List"
3. Name it "HeritageBox Customers"
4. Copy the List ID from the URL - this is your `SENDGRID_LIST_ID`

**Set up Marketing Automation:**
1. Go to Marketing > Automations
2. Click "Create an Automation"
3. Choose "Custom Automation"
4. Set trigger: "When a contact is added to list" → Select your HeritageBox list
5. Add email steps for each month (explained below)

### Dropbox
1. Go to https://www.dropbox.com/developers/apps
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox" access
5. Name it "HeritageBox Automation"
6. Go to the Permissions tab and enable:
   - `files.content.write`
   - `sharing.write`
7. Go to Settings tab and click "Generate access token"
8. Copy the token - this is your `DROPBOX_ACCESS_TOKEN`

---

## Step 2: Install and Configure

### Local Installation

```bash
# Navigate to the project folder
cd heritagebox-automation

# Install dependencies
npm install

# Create your .env file
cp .env.example .env

# Edit .env with your actual API keys
nano .env  # or use any text editor
```

Fill in your `.env` file with the keys from Step 1.

---

## Step 3: Set Up Airtable Automations

You'll create 3 automations in Airtable that trigger webhooks to your server.

### Automation 1: New Prospect → Marketing Enrollment

**In Airtable:**
1. Go to "Automations" tab
2. Click "+ Create automation"
3. Name it: "Enroll New Prospect in Marketing"
4. **Trigger:** "When record created" → Select "Prospects" table
5. **Action:** "Send request"
   - Method: POST
   - URL: `https://your-server-url.com/webhook/new-prospect`
   - Body:
   ```json
   {
     "record": {
       "id": "{{RECORD_ID}}",
       "fields": {
         "Email": "{{Email}}",
         "First Name": "{{First Name}}",
         "Last Name": "{{Last Name}}",
         "Source": "{{Source}}"
       }
     }
   }
   ```
6. Turn it ON

### Automation 2: Order Status Change → Email Customer

**In Airtable:**
1. Create new automation: "Send Order Status Email"
2. **Trigger:** "When record updated" → Select "Orders" table
3. **Condition:** Add condition "When Ops Status Key is not empty"
4. **Action:** "Send request"
   - Method: POST
   - URL: `https://your-server-url.com/webhook/order-status-changed`
   - Body:
   ```json
   {
     "record": {
       "id": "{{RECORD_ID}}",
       "fields": {
         "Order Number": "{{Order Number}}",
         "Customer Name": "{{Customer Name}}",
         "Customer Email": "{{Customer Email}}",
         "Ops Status": "{{Ops Status}}",
         "Ops Status Key": "{{Ops Status Key}}",
         "Dropbox Link": "{{Dropbox Link}}"
       }
     }
   }
   ```
5. Turn it ON

### Automation 3: New Order → Create Dropbox Folder

**In Airtable:**
1. Create new automation: "Create Dropbox Folder for Order"
2. **Trigger:** "When record matches conditions"
   - Table: Orders
   - Conditions: "Ops Status Key" is "PENDING"
3. **Action:** "Send request"
   - Method: POST
   - URL: `https://your-server-url.com/webhook/create-dropbox-folder`
   - Body:
   ```json
   {
     "record": {
       "id": "{{RECORD_ID}}",
       "fields": {
         "Customer Name": "{{Customer Name}}",
         "Order Number": "{{Order Number}}"
       }
     }
   }
   ```
4. Turn it ON

---

## Step 4: Deploy Your Server

### Option A: Deploy to Railway (Recommended - Free tier available)

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Connect your repo (or create one and push this code)
5. Add environment variables:
   - Go to your project → Variables
   - Add all variables from your `.env` file
6. Railway will auto-deploy and give you a URL like `heritagebox-automation.up.railway.app`
7. Use this URL in your Airtable automations

### Option B: Deploy to Render

1. Go to https://render.com
2. Sign up and create "New Web Service"
3. Connect your GitHub repo
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables from your `.env` file
7. Deploy and copy the URL

### Option C: Run Locally (Testing Only)

```bash
npm start
```

For local testing, you'll need to use ngrok to expose your local server:
```bash
# Install ngrok
npm install -g ngrok

# In one terminal, run your server
npm start

# In another terminal, expose it
ngrok http 3000

# Use the ngrok URL in your Airtable automations
```

---

## Step 5: Set Up SendGrid Monthly Email Campaign

In SendGrid, create your automation with monthly emails:

### Email 1 - Welcome Email (Immediately after signup)
**Subject:** "Welcome to HeritageBox - Let's Preserve Your Memories!"
**Content:** Introduction to service, what to expect, how it works

### Email 2 - One Month Later
**Subject:** "Ready to Get Started? Your Heritage Box Awaits"
**Content:** Gentle reminder, benefits of digitizing, customer testimonials

### Email 3 - Two Months Later
**Subject:** "Special Offer: 15% Off Your First Heritage Box"
**Content:** Limited time discount, urgency, easy ordering process

### Email 4 - Three Months Later
**Subject:** "Preserve Before It's Too Late - Stories from Our Customers"
**Content:** Emotional stories, importance of preservation, final CTA

You can create these in SendGrid Marketing > Automations and set the delays between each email.

---

## Step 6: Test Everything

### Test 1: Marketing Enrollment
1. Add a new prospect in Airtable with your email
2. Check SendGrid contacts list - you should be added
3. Check your email - you should receive the first marketing email

### Test 2: Order Status Email
1. Create a test order or update an existing order's Ops Status
2. Change from "Pending" → "Kit Sent"
3. Check the customer email - should receive status update

### Test 3: Dropbox Folder
1. Create a new order with Ops Status = "Pending"
2. Check your Dropbox - folder should be created
3. Check Airtable - "Dropbox Link" field should be populated

---

## Monitoring and Logs

### View Logs
- **Railway:** Dashboard → Deployments → View Logs
- **Render:** Dashboard → Logs tab
- **Local:** Check your terminal

### Health Check
Visit `https://your-server-url.com/health` to verify server is running

---

## Troubleshooting

### "Error: Missing email field"
- Make sure your Airtable automation is sending all required fields
- Check that field names match exactly (case-sensitive)

### SendGrid emails not sending
- Verify your SendGrid API key has "Mail Send" permission
- Check that `SENDGRID_FROM_EMAIL` is a verified sender in SendGrid
- Go to SendGrid → Settings → Sender Authentication

### Dropbox folder not creating
- Verify Dropbox token has correct permissions
- Check that you're not creating duplicate folder names
- Review Dropbox API quota limits

### Webhooks timing out
- Your server might be down - check deployment logs
- Verify the webhook URL is correct (https, not http)
- Check Airtable automation run history for errors

---

## Need Help?

Check the logs first - they'll tell you exactly what's happening. Most issues are:
1. Wrong API keys in `.env`
2. Missing permissions on API tokens
3. Typos in field names in Airtable automations

---

## What Happens Now?

✅ **New prospects** automatically get enrolled in your monthly email campaign  
✅ **Order status changes** trigger professional, branded emails to customers  
✅ **New orders** get Dropbox folders created and links saved automatically  

Everything runs in the background - you just focus on delivering great service!
