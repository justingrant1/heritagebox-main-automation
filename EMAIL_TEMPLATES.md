# Email Templates Reference

Quick reference for customizing the automated emails sent to customers.

## 📧 Order Status Email Templates

All templates are in `server.js` in the `emailTemplates` object. Edit them to match your brand voice.

---

### PENDING - Order Received
**Trigger:** When order is created or moves to PENDING  
**Purpose:** Confirm receipt and set expectations

**Current Subject:** `Order {orderNumber} - We've Received Your Order!`

**Key Points to Include:**
- Thank them for ordering
- Explain what happens next (kit being prepared)
- Set timeline expectations
- Offer support contact

---

### KIT_SENT - Kit Shipped
**Trigger:** When Ops Status changes to "Kit Sent"  
**Purpose:** Notify kit is on the way

**Current Subject:** `Order {orderNumber} - Your Kit is On The Way! 📦`

**Key Points to Include:**
- Confirm shipment
- Instructions for when kit arrives
- What to include in the box
- How to return it (prepaid label)

---

### MEDIA_RECEIVED - Media Arrived
**Trigger:** When Ops Status changes to "Media Received"  
**Purpose:** Confirm receipt of customer's items

**Current Subject:** `Order {orderNumber} - We've Received Your Memories! 📸`

**Key Points to Include:**
- Confirm safe receipt
- Mention careful handling
- Explain next steps (cataloging, digitization)
- Timeline estimate

---

### DIGITIZING - Work In Progress
**Trigger:** When Ops Status changes to "Digitizing"  
**Purpose:** Update on progress

**Current Subject:** `Order {orderNumber} - Digitization In Progress 🎬`

**Key Points to Include:**
- Work is underway
- Care being taken
- Next step (quality check)

---

### QUALITY_CHECK - QC Review
**Trigger:** When Ops Status changes to "Quality Check"  
**Purpose:** Inform they're almost done

**Current Subject:** `Order {orderNumber} - Quality Review Underway ✓`

**Key Points to Include:**
- Files are being reviewed
- High standards being maintained
- Almost complete

---

### SHIPPING_BACK - Returning Items
**Trigger:** When Ops Status changes to "Shipping Back"  
**Purpose:** Notify originals are returning

**Current Subject:** `Order {orderNumber} - Your Originals Are Coming Home! 📦`

**Key Points to Include:**
- Items carefully packaged
- Shipped back to them
- Digital files coming soon

---

### COMPLETE - All Done! 🎉
**Trigger:** When Ops Status changes to "Complete"  
**Purpose:** Deliver digital files and close order

**Current Subject:** `Order {orderNumber} - Your Digital Memories Are Ready! 🎉`

**Key Points to Include:**
- Congratulations/celebration
- **DROPBOX LINK** (most important!)
- What they'll find in their files
- Reminder about originals
- Thank them for trust

**Special:** This email includes the Dropbox folder link if available.

---

### CANCELED - Order Cancelled
**Trigger:** When Ops Status changes to "Canceled / Refunded"  
**Purpose:** Confirm cancellation

**Current Subject:** `Order {orderNumber} - Order Canceled`

**Key Points to Include:**
- Confirmation of cancellation
- Offer to help if error
- Keep tone positive

---

## 🎨 Customization Guide

### How to Edit Templates

1. Open `server.js`
2. Find the `emailTemplates` object (around line 80)
3. Edit the HTML for any status
4. Save and restart server

### HTML Email Best Practices

```html
<!-- ✅ Good: Simple, readable HTML -->
<h2>Hello {{customerName}}!</h2>
<p>Your order is ready.</p>
<a href="{{link}}" style="display:inline-block;background-color:#0061ff;color:white;padding:12px 24px;">
  View Files
</a>

<!-- ❌ Avoid: Complex CSS, external stylesheets -->
<div class="fancy-container">  <!-- Won't work in email -->
  <link rel="stylesheet" href="style.css">  <!-- Won't load -->
</div>
```

### Variables Available in Templates

- `${customerName}` - Customer's full name
- `${orderNumber}` - Order number
- `${dropboxLink}` - Dropbox folder link (only populated at COMPLETE stage)

### Adding Your Logo

```html
<img src="https://your-website.com/logo.png" 
     alt="Heritage Box" 
     style="max-width:200px;margin-bottom:20px;">
```

### Styling Buttons

```html
<a href="${dropboxLink}" 
   style="display:inline-block;
          background-color:#0061ff;
          color:white;
          padding:12px 24px;
          text-decoration:none;
          border-radius:5px;
          font-weight:bold;
          margin:20px 0;">
  Access Your Files
</a>
```

### Email Color Scheme Suggestions

**Professional Blue:**
- Primary: `#0061ff`
- Secondary: `#4285f4`
- Text: `#333333`

**Warm & Trustworthy:**
- Primary: `#e67e22`
- Secondary: `#d35400`
- Text: `#2c3e50`

**Elegant Purple:**
- Primary: `#8e44ad`
- Secondary: `#9b59b6`
- Text: `#34495e`

---

## 📋 SendGrid Marketing Campaign Templates

For the monthly drip campaign, create these in SendGrid:

### Month 1: Welcome Email (Day 0)
**Subject:** Welcome to Heritage Box 📦

**Goal:** Introduce service, build trust, set expectations

**Content Ideas:**
- Thank them for interest
- Explain how easy the process is
- Share customer testimonial
- Soft CTA: "Order your kit"

### Month 2: Educational Email (Day 30)
**Subject:** Why Digitizing Your Memories Matters

**Goal:** Educate on importance, create urgency

**Content Ideas:**
- Statistics on photo/video deterioration
- Stories of memories preserved
- Limited time benefits
- Medium CTA: "Get started today"

### Month 3: Social Proof Email (Day 60)
**Subject:** See What Our Customers Are Saying ⭐

**Goal:** Build trust through testimonials

**Content Ideas:**
- 3-5 customer success stories
- Before/after examples
- Star ratings/reviews
- Strong CTA: "Join hundreds of happy customers"

### Month 4: Discount Offer Email (Day 90)
**Subject:** Special Offer: 15% Off Your First Heritage Box

**Goal:** Convert with incentive

**Content Ideas:**
- Exclusive discount code
- Create urgency (expires in 7 days)
- Highlight service benefits
- Very strong CTA: "Claim your discount now"

---

## 🔧 Technical Email Settings

### SendGrid Configuration

**From Email:** `noreply@heritagebox.com` (or your domain)
**From Name:** "Heritage Box Team"
**Reply-To:** `support@heritagebox.com` (real support email)

### Deliverability Tips

1. **Authenticate your domain** in SendGrid
   - SPF record
   - DKIM keys
   - Domain verification

2. **Use a real from-address** (not @gmail.com)

3. **Include unsubscribe link** (SendGrid adds automatically)

4. **Test with Mail Tester** (mail-tester.com)

5. **Monitor bounce rates** in SendGrid dashboard

---

## 📊 Email Performance Tracking

SendGrid automatically tracks:
- Opens
- Clicks
- Bounces
- Unsubscribes

**View Stats:**
1. Go to SendGrid dashboard
2. Click "Email Activity"
3. Filter by date range or email

**Key Metrics:**
- Open rate target: >20%
- Click rate target: >3%
- Bounce rate: <2%

---

## 🎯 Email Testing Checklist

Before sending to real customers:

- [ ] Test email displays correctly on mobile
- [ ] All links work correctly
- [ ] Dropbox link appears when it should
- [ ] Customer name appears correctly
- [ ] Order number is correct
- [ ] Images load properly
- [ ] Unsubscribe link is present
- [ ] From/reply-to addresses are correct
- [ ] Subject line is compelling
- [ ] Tone matches your brand

**Test Tools:**
- Litmus (paid) - Shows email in all clients
- Email on Acid (paid) - Similar to Litmus
- Mail Tester (free) - Checks deliverability score
- SendGrid's test send feature

---

## 💡 Email Writing Tips

### Subject Lines
- Keep under 50 characters
- Create curiosity or urgency
- Include order number for status updates
- Use emoji sparingly (1 max)

### Body Copy
- Use short paragraphs (2-3 lines max)
- One main CTA per email
- Scannable bullet points
- Personal, conversational tone
- Clear next steps

### Call-to-Action (CTA)
- Use action verbs: "View", "Download", "Access"
- Make buttons obvious
- Only one primary CTA
- Use contrasting colors

---

## 🚫 Email Anti-Patterns (Don't Do This)

❌ All caps subject lines: "ORDER READY!!!"
❌ Multiple CTAs competing for attention
❌ Super long paragraphs
❌ Generic greetings: "Dear Customer"
❌ No mobile optimization
❌ Broken or missing links
❌ Corporate jargon: "leverage synergies"
❌ Unclear next steps

---

## 📝 Template Maintenance

**Monthly:**
- Review email performance metrics
- Update based on customer feedback
- A/B test subject lines

**Quarterly:**
- Refresh template designs
- Update brand colors if changed
- Review and update copy

**Yearly:**
- Major template redesign
- Update customer testimonials
- Refresh imagery

---

## 🆘 Common Email Issues & Fixes

**Problem:** Emails going to spam
**Fix:** Authenticate domain, check content for spam triggers, warm up sending

**Problem:** Low open rates
**Fix:** Better subject lines, optimal send times, clean email list

**Problem:** Dropbox link not appearing
**Fix:** Check that link is saved in Airtable before COMPLETE status email

**Problem:** Customer name showing as "Valued Customer"
**Fix:** Ensure Customer Name field is populated in Airtable

**Problem:** Broken HTML formatting
**Fix:** Use inline styles only, test in multiple email clients

---

Need help customizing? Check the server.js file or consult SendGrid's documentation for advanced features!
