import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('⚠️  Twilio credentials not fully configured. SMS features will be disabled.');
}

// Create Twilio client (will be undefined if credentials are missing)
export const twilioClient = accountSid && authToken 
  ? twilio(accountSid, authToken) 
  : null;

export { twilioPhoneNumber };

/**
 * Send an SMS message via Twilio
 */
export async function sendSMS(to: string, message: string) {
  if (!twilioClient || !twilioPhoneNumber) {
    throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment variables.');
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      to: to,
      from: twilioPhoneNumber,
    });

    console.log('✅ SMS sent successfully:', {
      sid: result.sid,
      to: to,
      status: result.status,
    });

    return {
      success: true,
      messageSid: result.sid,
      status: result.status,
    };
  } catch (error: any) {
    console.error('❌ Error sending SMS:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Format the daily financial update message
 */
export function formatDailyMessage(data: {
  name: string;
  bankBalance: number;
  yesterdaySpending: number;
  weekSpending: number;
  bankName?: string;
}) {
  const { name, bankBalance, yesterdaySpending, weekSpending, bankName } = data;
  
  const balanceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(bankBalance);

  const yesterdayFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(yesterdaySpending));

  const weekFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(weekSpending));

  const yesterdaySign = yesterdaySpending > 0 ? '+' : '-';
  const weekSign = weekSpending > 0 ? '+' : '-';

  return `📊 3Numbers Daily Update

Hi ${name}! Here are your 3 key numbers:

💰 Bank Balance: ${balanceFormatted}${bankName ? ` (${bankName})` : ''}
📉 Yesterday: ${yesterdaySign}${yesterdayFormatted}
📊 This Week: ${weekSign}${weekFormatted}

Stay financially aware! 💪`;
}

/**
 * Send daily financial update to a user
 */
export async function sendDailyUpdate(
  phoneNumber: string,
  data: {
    name: string;
    bankBalance: number;
    yesterdaySpending: number;
    weekSpending: number;
    bankName?: string;
  }
) {
  const message = formatDailyMessage(data);
  return await sendSMS(phoneNumber, message);
}

