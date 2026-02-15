# Dropbox Refresh Token Setup Guide

## Problem Solved
The previous implementation used a hardcoded Dropbox access token that expired every 4 hours, requiring manual token rotation. This new implementation uses a **refresh token flow** that automatically generates fresh access tokens on-demand, eliminating the need for manual intervention.

## How It Works
1. **Refresh Token**: A long-lived token (never expires) stored in environment variables
2. **Access Token**: Short-lived token (4 hours) generated automatically when needed
3. **Auto-Renewal**: Each webhook call gets a fresh access token using the refresh token

## Railway Environment Variables Setup

### Step 1: Access Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Navigate to your project: `heritagebox-main-automation-production`
3. Click on the **Variables** tab

### Step 2: Add New Environment Variables
Add these three new variables (use your actual values):

```
DROPBOX_REFRESH_TOKEN=your_refresh_token_here
DROPBOX_APP_KEY=your_app_key_here
DROPBOX_APP_SECRET=your_app_secret_here
```

**Note**: Replace the placeholder values with your actual Dropbox credentials. You should have received these when you generated the refresh token.

### Step 3: Remove Old Variable
Delete the old environment variable:
```
DROPBOX_ACCESS_TOKEN (remove this)
```

### Step 4: Deploy Changes
Railway will automatically redeploy your application with the new environment variables.

## Code Changes Summary

### 1. Added Token Refresh Function
```javascript
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
```

### 2. Updated Webhook Handler
The `/webhook/create-dropbox-folder` endpoint now:
- Gets a fresh access token on each request
- Creates a new Dropbox client with that token
- Uses the client to create folders and shared links

**Before:**
```javascript
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN }); // Static, expires
```

**After:**
```javascript
const accessToken = await getDropboxAccessToken(); // Fresh token every time
const dbx = new Dropbox({ accessToken });
```

## Testing the Implementation

### Local Testing
1. Update your local `.env` file with the new variables:
   ```
   DROPBOX_REFRESH_TOKEN=your_refresh_token_here
   DROPBOX_APP_KEY=your_app_key_here
   DROPBOX_APP_SECRET=your_app_secret_here
   ```

2. Remove the old `DROPBOX_ACCESS_TOKEN` line

3. Restart your server:
   ```bash
   npm start
   ```

4. Test the Dropbox webhook endpoint

### Production Testing
After deploying to Railway:
1. Trigger the Airtable automation that calls the Dropbox webhook
2. Check Railway logs for successful folder creation
3. Verify the Dropbox folder was created and shared link generated

## Troubleshooting

### Error: "Failed to refresh Dropbox token"
**Cause**: Invalid refresh token, app key, or app secret

**Solution**: 
1. Verify all three environment variables are set correctly in Railway
2. Check for typos or extra spaces
3. Ensure the refresh token hasn't been revoked

### Error: "Dropbox credentials not configured"
**Cause**: Missing environment variables

**Solution**:
1. Confirm all three variables are set in Railway:
   - `DROPBOX_REFRESH_TOKEN`
   - `DROPBOX_APP_KEY`
   - `DROPBOX_APP_SECRET`
2. Redeploy the application

### Token Still Expiring
**Cause**: Old `DROPBOX_ACCESS_TOKEN` variable still present

**Solution**:
1. Remove the old `DROPBOX_ACCESS_TOKEN` variable from Railway
2. Ensure the code is using the new refresh token flow
3. Redeploy

## Security Notes

✅ **Refresh tokens are more secure** than storing access tokens because:
- They're only used server-side to generate short-lived access tokens
- Access tokens are never stored, only generated on-demand
- If an access token is compromised, it expires in 4 hours

⚠️ **Keep these credentials secure**:
- Never commit them to version control
- Only store them in Railway environment variables
- Rotate them if you suspect they've been compromised

## Benefits of This Implementation

1. ✅ **No More Manual Token Rotation**: Tokens refresh automatically
2. ✅ **Zero Downtime**: No more 4-hour expiration issues
3. ✅ **Better Security**: Short-lived access tokens reduce risk
4. ✅ **Simpler Maintenance**: Set it once, forget about it
5. ✅ **Production Ready**: Works reliably at scale

## Additional Resources

- [Dropbox OAuth Guide](https://www.dropbox.com/developers/documentation/http/documentation#oauth2-token)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Dropbox API Reference](https://www.dropbox.com/developers/documentation/http/overview)
