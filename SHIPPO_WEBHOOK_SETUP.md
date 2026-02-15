# 🚢 Shippo Webhook Setup Instructions

## Your Webhook URL

```
https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking
```

---

## Step-by-Step Setup

### Option 1: Via Shippo Dashboard (Recommended) ⭐

1. **Go to Shippo Dashboard**
   - Visit: https://goshippo.com/user/apikeys/
   - Log in to your Shippo account

2. **Navigate to Webhooks**
   - Click on "Webhooks" in the left sidebar or settings

3. **Add New Webhook**
   - Click "Add Webhook" or "Create Webhook" button

4. **Configure Webhook**
   - **URL:** `https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking`
   - **Events:** Select **"Track Updated"** (`track_updated`)
   - **Active:** ✅ Yes/Enabled
   - **Description:** (Optional) "HeritageBox Order Status Automation"

5. **Save and Get Secret**
   - Click "Save" or "Create"
   - Shippo will generate a **Webhook Secret** for security
   - Copy this secret (it will look like: `whsec_xxxxxxxxxxxxxxxxxxxxx`)
   - **Important:** This secret is used to verify that webhook requests are actually from Shippo

6. **Add Variables to Railway**
   - Go to your Railway dashboard: https://railway.app/
   - Navigate to your project: `heritagebox-main-automation-production`
   - Go to "Variables" tab
   - Add these two variables:
   
   **Variable 1:**
   - **Key:** `SHIPPO_API_TOKEN`
   - **Value:** `your_shippo_api_token_here`
   
   **Variable 2:**
   - **Key:** `SHIPPO_WEBHOOK_SECRET`
   - **Value:** `whsec_xxxxxxxxxxxxxxxxxxxxx` (paste the secret from Shippo)
   
   - Click "Add" or "Save"
   - Railway will automatically redeploy your app with these new variables

---

### Option 2: Via Shippo API

If you prefer to use the API, run this command:

```bash
curl https://api.goshippo.com/webhooks/ \
  -H "Authorization: ShippoToken YOUR_SHIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking",
    "event": "track_updated",
    "active": true,
    "is_test": false
  }'
```

The response will include the webhook secret. Copy it and add to Railway as described above.

---

## Testing the Webhook

### Test 1: Check Endpoint is Live

```bash
curl -X POST https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Expected response: `{"error":"Invalid signature"}` (This is good! It means the endpoint is working)

### Test 2: Check with Real Tracking Number

Use the `check-shippo-tracking.js` script to verify a tracking number:

```bash
node check-shippo-tracking.js 1Z0Y3G510331997230
```

This will show you the current status from Shippo's API.

---

## Webhook Event Flow

When a package is scanned by UPS:

```
1. UPS scans package
   ↓
2. Shippo receives update from UPS
   ↓
3. Shippo sends webhook to your server:
   https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking
   ↓
4. Your server validates signature
   ↓
5. Server finds order by tracking number
   ↓
6. Server determines new status
   ↓
7. Server updates Airtable "Ops Status" field
   ↓
8. Airtable automation detects change
   ↓
9. Airtable sends email to customer
```

---

## Status Transitions

### Automatic (Shippo Webhook):
- `Pending` → `Kit Sent` (Label 1 scanned)
- `Kit Sent` → `Media Received` (Label 2 delivered)
- `Quality Check` → `Shipping Back` (Label 3 scanned)
- `Shipping Back` → `Complete` (Label 3 delivered)

### Manual (Employee App):
- `Media Received` → `Digitizing` → `Quality Check`

---

## Monitoring

### Check Railway Logs

1. Go to Railway dashboard
2. Select your project
3. Click "Deployments" tab
4. Click on the latest deployment
5. View logs in real-time

Look for these log messages:
- `📦 Shippo tracking webhook received`
- `✅ Found order: [order number]`
- `✅ Updated order [order number]: [old status] → [new status]`

### Check Shippo Dashboard

1. Go to https://goshippo.com/user/apikeys/
2. Click on "Webhooks"
3. Click on your webhook
4. View "Recent Deliveries" to see webhook attempts and responses

---

## Troubleshooting

### Issue: Webhook not receiving events

**Check:**
1. Webhook is active in Shippo dashboard
2. URL is correct (no typos)
3. Railway app is running (check deployment status)
4. Check Railway logs for errors

### Issue: "Invalid signature" errors

**Solution:**
1. Verify `SHIPPO_WEBHOOK_SECRET` in Railway matches Shippo dashboard
2. If secret was regenerated in Shippo, update Railway variable
3. Redeploy app after updating variable

### Issue: Order not found

**Check:**
1. Tracking number is saved in Airtable
2. Tracking number has no extra spaces
3. Check Railway logs to see which tracking number was received

### Issue: Status not updating

**Check:**
1. Current order status allows the transition (see valid transitions above)
2. Airtable API key has write permissions
3. Field name is exactly "Ops Status" (case-sensitive)

---

## Security Notes

✅ **Webhook signatures are validated** - Only requests from Shippo with valid signatures are processed

✅ **HTTPS only** - Railway provides SSL/TLS automatically

✅ **Environment variables** - Secrets are stored securely in Railway

---

## Support

- **Shippo Support:** https://support.goshippo.com/
- **Shippo API Docs:** https://goshippo.com/docs/webhooks
- **Railway Docs:** https://docs.railway.app/

---

**Last Updated:** February 14, 2026  
**Webhook URL:** `https://heritagebox-main-automation-production.up.railway.app/webhook/shippo-tracking`
