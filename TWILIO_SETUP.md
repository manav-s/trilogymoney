# 📱 Twilio SMS Setup Guide

## Step 1: Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free trial account
3. Verify your phone number (this is required for sending test messages)
4. Complete the account setup

## Step 2: Get Your Credentials

After signing up, you'll need three things:

### 1. Account SID
- Found on your [Twilio Console Dashboard](https://console.twilio.com/)
- Looks like: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Auth Token
- Also on your Console Dashboard
- Click "Show" to reveal it
- Looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3. Phone Number
- Click "Get a Trial Number" button
- Twilio will assign you a free trial number
- Looks like: `+1234567890`

## Step 3: Add to Environment Variables

Add these three values to your `.env.local` file:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"
```

## Step 4: Restart Your Dev Server

After adding the credentials:
1. Stop your dev server (Ctrl+C)
2. Run `npm run dev` again
3. The Twilio client will now be initialized

## Step 5: Test SMS Sending

1. Go to your dashboard at `http://localhost:3000/dashboard`
2. Find the "📱 SMS Testing" card
3. Click "Send Test SMS"
4. You should receive a text message with your daily financial update!

## Trial Account Limitations

⚠️ **Important**: Twilio trial accounts have some restrictions:

- **Can only send to verified phone numbers**
  - The phone you verified during signup is automatically added
  - To add more numbers: Console → Phone Numbers → Verified Caller IDs
- **Messages include "Sent from a Twilio trial account" prefix**
- **Limited to $15.50 in free credits** (~500 SMS messages)

## Upgrading to Production

When ready to launch:
1. Upgrade your Twilio account (requires credit card)
2. No code changes needed!
3. Messages will no longer have the trial prefix
4. Can send to any phone number

## Troubleshooting

### "Twilio is not configured" error
- Double-check all three env variables are set correctly
- Make sure there are no extra quotes or spaces
- Restart your dev server after adding variables

### "The number +X is unverified" error
- You're on a trial account
- Add the phone number to Verified Caller IDs in Twilio Console
- Or upgrade your account to send to any number

### Message not received
- Check Twilio Console → Monitor → Logs → Messaging
- Verify the phone number format includes country code (+1 for US)
- Make sure the recipient phone can receive SMS

## Message Format

Your daily SMS will look like this:

```
📊 3Numbers Daily Update

Hi [Name]! Here are your 3 key numbers:

💰 Bank Balance: $2,547.83 (Chase)
📉 Yesterday: -$47.20
📊 This Week: -$312.45

Stay financially aware! 💪
```

## Need Help?

- [Twilio SMS Quickstart](https://www.twilio.com/docs/sms/quickstart)
- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [Twilio Support](https://support.twilio.com/)

