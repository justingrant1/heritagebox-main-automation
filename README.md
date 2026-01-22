# HeritageBox Automation Service

Automated workflows for HeritageBox Airtable operations including marketing enrollment, order status emails, and Dropbox folder management.

## 🎯 What This Does

### 1. Marketing Email Automation
- Automatically enrolls new prospects from Airtable into SendGrid marketing lists
- Triggers a monthly email drip campaign
- Keeps customer data synced between Airtable and SendGrid

### 2. Order Status Notifications
- Sends branded email to customers when order status changes
- Covers all order stages: Pending → Kit Sent → Media Received → Digitizing → Quality Check → Shipping Back → Complete
- Includes Dropbox link in completion email

### 3. Dropbox Folder Management
- Creates a dedicated folder for each new order
- Folder naming: "[Customer Name] - [Order Number]"
- Generates shareable link and saves to Airtable
- Automatically organizes all customer files

## 📋 Quick Start

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Test Locally**
   ```bash
   npm start
   npm test  # Run test suite
   ```

4. **Deploy** (see SETUP_GUIDE.md for detailed instructions)

## 📁 Project Structure

```
heritagebox-automation/
├── server.js              # Main automation server
├── package.json           # Dependencies
├── .env.example           # Environment template
├── SETUP_GUIDE.md         # Complete setup instructions
├── test-webhooks.js       # Test suite
└── README.md             # This file
```

## 🔧 Configuration

Required environment variables:

```env
AIRTABLE_API_KEY=         # Your Airtable API token
AIRTABLE_BASE_ID=         # Your base ID (starts with "app")
SENDGRID_API_KEY=         # SendGrid API key
SENDGRID_FROM_EMAIL=      # Verified sender email
SENDGRID_LIST_ID=         # Marketing list ID
DROPBOX_ACCESS_TOKEN=     # Dropbox API token
PORT=3000                 # Server port
```

## 🚀 API Endpoints

### POST /webhook/new-prospect
Enrolls a new prospect in marketing automation
```json
{
  "record": {
    "id": "recXXX",
    "fields": {
      "Email": "customer@example.com",
      "First Name": "John",
      "Last Name": "Doe"
    }
  }
}
```

### POST /webhook/order-status-changed
Sends status update email to customer
```json
{
  "record": {
    "id": "recXXX",
    "fields": {
      "Order Number": "HB-12345",
      "Customer Email": "customer@example.com",
      "Ops Status Key": "PENDING"
    }
  }
}
```

### POST /webhook/create-dropbox-folder
Creates folder and returns shareable link
```json
{
  "record": {
    "id": "recXXX",
    "fields": {
      "Customer Name": "John Doe",
      "Order Number": "HB-12345"
    }
  }
}
```

### GET /health
Health check endpoint
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T12:00:00.000Z"
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Start dev server with auto-reload
npm run dev
```

## 📖 Full Documentation

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for:
- Step-by-step API key acquisition
- Airtable automation configuration
- SendGrid campaign setup
- Deployment instructions
- Troubleshooting guide

## 🛠️ Tech Stack

- **Node.js** + Express - Server framework
- **Airtable API** - Database operations
- **SendGrid API** - Email marketing and transactional emails
- **Dropbox API** - File storage and sharing
- **Axios** - HTTP requests

## 📝 Order Status Flow

```
PENDING → KIT_SENT → MEDIA_RECEIVED → DIGITIZING → 
QUALITY_CHECK → SHIPPING_BACK → COMPLETE
```

Each transition triggers a customer email with relevant updates.

## 🔐 Security Notes

- Never commit `.env` file to version control
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Use HTTPS in production
- Verify webhook signatures in production (add this feature)

## 🐛 Troubleshooting

**Server won't start:**
- Check all environment variables are set
- Verify API keys are valid
- Ensure port 3000 isn't already in use

**Emails not sending:**
- Verify SendGrid API key permissions
- Check sender email is verified in SendGrid
- Review SendGrid activity logs

**Dropbox folder not creating:**
- Verify Dropbox token permissions
- Check available storage space
- Review Dropbox API logs

**Webhooks timing out:**
- Check server is running and accessible
- Verify webhook URLs in Airtable
- Review server logs for errors

## 📊 Monitoring

- Server logs show all webhook activity
- Use `/health` endpoint for uptime monitoring
- Monitor SendGrid dashboard for email delivery
- Check Airtable automation run history

## 🚢 Deployment Options

1. **Railway** (Recommended) - Free tier, auto-deploy from GitHub
2. **Render** - Easy setup, good free tier
3. **Heroku** - Classic option, paid
4. **AWS/GCP** - Full control, requires more setup

## 📞 Support

For issues specific to this automation:
1. Check server logs
2. Review SETUP_GUIDE.md
3. Test with test-webhooks.js
4. Verify all API keys and permissions

## 📄 License

ISC

---

Built for HeritageBox - Preserving memories, one box at a time 📦✨
