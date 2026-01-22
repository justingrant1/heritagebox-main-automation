# Airtable Automation Configuration Guide

## Visual Setup Instructions

This guide shows you EXACTLY how to configure each Airtable automation with screenshots descriptions.

---

## ⚙️ AUTOMATION 1: New Prospect Marketing Enrollment

### Trigger Setup
```
┌─────────────────────────────────────┐
│ When record created                 │
│ Table: Prospects                    │
└─────────────────────────────────────┘
```

### Action Setup
```
┌─────────────────────────────────────────────────────┐
│ Send request                                        │
│                                                     │
│ Method:  POST                                       │
│ URL:     https://your-server.com/webhook/new-prospect │
│                                                     │
│ Body:                                               │
│ {                                                   │
│   "record": {                                       │
│     "id": "{{AIRTABLE_RECORD_ID()}}",              │
│     "fields": {                                     │
│       "Email": "{{Email}}",                         │
│       "First Name": "{{First Name}}",               │
│       "Last Name": "{{Last Name}}",                 │
│       "Source": "{{Source}}"                        │
│     }                                               │
│   }                                                 │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

**Field Mapping:**
- `{{AIRTABLE_RECORD_ID()}}` - Use the dynamic field, don't type this
- `{{Email}}` - Select from "Prospects" table fields dropdown
- `{{First Name}}` - Select from "Prospects" table fields dropdown
- `{{Last Name}}` - Select from "Prospects" table fields dropdown
- `{{Source}}` - Select from "Prospects" table fields dropdown

---

## ⚙️ AUTOMATION 2: Order Status Email Notification

### Trigger Setup
```
┌─────────────────────────────────────┐
│ When record updated                 │
│ Table: Orders                       │
│ Field: Ops Status Key               │
└─────────────────────────────────────┘
```

### Condition (Optional but Recommended)
```
┌─────────────────────────────────────┐
│ Add condition                       │
│ When: Ops Status Key                │
│ is not empty                        │
└─────────────────────────────────────┘
```

### Action Setup
```
┌─────────────────────────────────────────────────────────┐
│ Send request                                            │
│                                                         │
│ Method:  POST                                           │
│ URL:     https://your-server.com/webhook/order-status-changed │
│                                                         │
│ Body:                                                   │
│ {                                                       │
│   "record": {                                           │
│     "id": "{{AIRTABLE_RECORD_ID()}}",                  │
│     "fields": {                                         │
│       "Order Number": "{{Order Number}}",               │
│       "Customer Name": "{{Customer Name}}",             │
│       "Customer Email": "{{Customer Email}}",           │
│       "Ops Status": "{{Ops Status}}",                   │
│       "Ops Status Key": "{{Ops Status Key}}",           │
│       "Dropbox Link": "{{Dropbox Link}}"                │
│     }                                                   │
│   }                                                     │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

**Field Mapping:**
- All fields should be selected from "Orders" table dropdown
- Make sure field names match EXACTLY (case-sensitive)
- `Dropbox Link` may be empty initially - that's OK

---

## ⚙️ AUTOMATION 3: Dropbox Folder Creation

### Trigger Setup
```
┌─────────────────────────────────────┐
│ When record matches conditions      │
│ Table: Orders                       │
│                                     │
│ Conditions:                         │
│ • Ops Status Key = "PENDING"        │
└─────────────────────────────────────┘
```

**Important:** This should only run when a new order reaches "PENDING" status for the first time.

### Action Setup
```
┌─────────────────────────────────────────────────────────┐
│ Send request                                            │
│                                                         │
│ Method:  POST                                           │
│ URL:     https://your-server.com/webhook/create-dropbox-folder │
│                                                         │
│ Body:                                                   │
│ {                                                       │
│   "record": {                                           │
│     "id": "{{AIRTABLE_RECORD_ID()}}",                  │
│     "fields": {                                         │
│       "Customer Name": "{{Customer Name}}",             │
│       "Order Number": "{{Order Number}}"                │
│     }                                                   │
│   }                                                     │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

**Field Mapping:**
- `{{Customer Name}}` - Select from "Orders" table fields
- `{{Order Number}}` - Select from "Orders" table fields

---

## 🔍 How to Insert Dynamic Fields in Airtable

When typing the JSON body in Airtable's "Send request" action:

1. **For Record ID:**
   - Type `{` and Airtable will show a dropdown
   - Look for "AIRTABLE_RECORD_ID()"
   - Click it to insert

2. **For Table Fields:**
   - Type `{` and Airtable will show a dropdown
   - Scroll to find the field name
   - Click to insert (it will appear as `{{Field Name}}`)

3. **Important Notes:**
   - Don't manually type `{{Field Name}}` - use the dropdown
   - Field names are case-sensitive
   - If a field doesn't appear, check it exists in your table

---

## ✅ Testing Each Automation

### Test Automation 1: New Prospect
1. Turn on the automation
2. Add a new prospect with your email address
3. Check server logs - you should see enrollment happening
4. Check SendGrid contacts - you should be added to the list
5. Check your email - you should get the first marketing email

### Test Automation 2: Order Status Email
1. Turn on the automation
2. Find an existing order (or create one)
3. Change "Ops Status" from "Pending" to "Kit Sent"
4. Check server logs
5. Check customer's email - should receive "Kit On The Way" email

### Test Automation 3: Dropbox Folder
1. Turn on the automation
2. Create a new order (or change existing order to PENDING)
3. Check server logs - should show folder creation
4. Check Dropbox - folder should exist
5. Check Airtable - "Dropbox Link" field should be filled

---

## 🐛 Common Setup Mistakes

### ❌ Wrong: Typing field names manually
```json
{
  "Customer Name": "Customer Name"  // DON'T DO THIS
}
```

### ✅ Right: Using Airtable's dynamic fields
```json
{
  "Customer Name": "{{Customer Name}}"  // Inserted via dropdown
}
```

### ❌ Wrong: Missing AIRTABLE_RECORD_ID() function
```json
{
  "id": "recXXXX"  // DON'T hardcode an ID
}
```

### ✅ Right: Using the function
```json
{
  "id": "{{AIRTABLE_RECORD_ID()}}"  // Inserted via dropdown
}
```

### ❌ Wrong: Incorrect field capitalization
```json
{
  "customer name": "{{customer name}}"  // Wrong case
}
```

### ✅ Right: Exact field name from table
```json
{
  "Customer Name": "{{Customer Name}}"  // Matches table exactly
}
```

---

## 📋 Automation Checklist

Before turning each automation ON:

- [ ] Trigger is set to correct table
- [ ] All field names match your table exactly (case-sensitive)
- [ ] Webhook URL is correct (https://, not http://)
- [ ] Dynamic fields inserted via dropdown (not typed)
- [ ] JSON syntax is valid (no missing commas, brackets)
- [ ] Server is running and accessible
- [ ] .env file is configured with all API keys

---

## 🔄 Automation Flow Diagram

```
NEW PROSPECT ADDED
       ↓
┌──────────────────┐
│ Airtable creates │
│ new prospect     │
└──────────────────┘
       ↓
┌──────────────────┐
│ Automation 1     │
│ triggers webhook │
└──────────────────┘
       ↓
┌──────────────────┐
│ Server receives  │
│ prospect data    │
└──────────────────┘
       ↓
┌──────────────────┐
│ Add to SendGrid  │
│ marketing list   │
└──────────────────┘
       ↓
┌──────────────────┐
│ SendGrid starts  │
│ monthly campaign │
└──────────────────┘


ORDER STATUS CHANGES
       ↓
┌──────────────────┐
│ User updates     │
│ Ops Status       │
└──────────────────┘
       ↓
┌──────────────────┐
│ Automation 2     │
│ triggers webhook │
└──────────────────┘
       ↓
┌──────────────────┐
│ Server receives  │
│ order data       │
└──────────────────┘
       ↓
┌──────────────────┐
│ Server picks     │
│ email template   │
└──────────────────┘
       ↓
┌──────────────────┐
│ SendGrid sends   │
│ email to customer│
└──────────────────┘


NEW ORDER CREATED
       ↓
┌──────────────────┐
│ Order reaches    │
│ PENDING status   │
└──────────────────┘
       ↓
┌──────────────────┐
│ Automation 3     │
│ triggers webhook │
└──────────────────┘
       ↓
┌──────────────────┐
│ Server receives  │
│ order data       │
└──────────────────┘
       ↓
┌──────────────────┐
│ Create Dropbox   │
│ folder           │
└──────────────────┘
       ↓
┌──────────────────┐
│ Generate share   │
│ link             │
└──────────────────┘
       ↓
┌──────────────────┐
│ Update Airtable  │
│ with link        │
└──────────────────┘
```

---

## 💡 Pro Tips

1. **Test with your own email first** - Don't test with real customer emails initially

2. **Use test orders** - Create orders with "TEST" in the order number for testing

3. **Check automation run history** - Airtable shows when each automation ran and if it succeeded

4. **Monitor server logs** - Your server logs show exactly what's happening

5. **Start with one automation** - Get automation 1 working, then add 2, then 3

6. **Use ngrok for local testing** - Before deploying, test locally with ngrok

7. **Keep backups** - Export your automation configs before making changes

---

## 🎯 Expected Behavior

### When Working Correctly:

**New Prospect:**
- Added to Airtable → Shows in SendGrid within 30 seconds → Gets first email within a few minutes

**Order Status Change:**
- Status updated → Customer receives email within 1-2 minutes → Server logs show successful send

**New Order:**
- Order created with PENDING status → Dropbox folder appears → Airtable link field populates → All within 30 seconds

### When Something's Wrong:

- Check Airtable automation run history
- Check server logs (most informative)
- Verify API keys and permissions
- Test each endpoint individually with test-webhooks.js

---

That's it! Follow this guide step-by-step and you'll have fully automated workflows. 🚀
