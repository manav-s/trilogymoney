// User types
export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  phone: string;
  timezone: string;
  isVerified: boolean;
  messageTime: number;
  messageEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  promoCodeId?: string;
}

// Subscription types
export interface Subscription {
  id: string;
  userId: string;
  stripeId: string;
  status: SubscriptionStatus;
  priceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
  UNPAID = 'UNPAID'
}

// Plaid Account types
export interface PlaidAccount {
  id: string;
  userId: string;
  accessToken: string; // Encrypted
  itemId: string;
  accountId: string;
  bankName: string;
  accountName: string;
  accountType: string;
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Daily Numbers types
export interface DailyNumber {
  id: string;
  userId: string;
  date: Date;
  balance: number;
  yesterdaySpend: number;
  weekSpend: number;
  messageSent: boolean;
  messageSentAt?: Date;
  createdAt: Date;
}

// Promo Code types
export interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  createdAt: Date;
}

export enum PromoType {
  TRIAL_EXTENSION = 'TRIAL_EXTENSION',
  FREE_FOREVER = 'FREE_FOREVER'
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Onboarding form data
export interface OnboardingData {
  name: string;
  email: string;
  phone: string;
  city: string;
  timezone: string;
  messageTime: number;
  promoCode?: string;
}

// Phone verification
export interface PhoneVerification {
  phone: string;
  code: string;
}

// Plaid Link types
export interface PlaidLinkResponse {
  publicToken: string;
  metadata: {
    institution: {
      name: string;
      institution_id: string;
    };
    account: {
      id: string;
      name: string;
      type: string;
    };
  };
}

// SMS message format
export interface SMSMessage {
  balance: number;
  yesterdaySpend: number;
  weekSpend: number;
  date: Date;
}
