-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "preferredTime" TEXT NOT NULL DEFAULT '09:00',
    "name" TEXT,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'pre_auth',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "messagingStatus" TEXT NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analysisSummary" JSONB,
    "billingStatus" TEXT,
    "quizAnswers" JSONB,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "stripeSubscriptionId" TEXT,
    "lastWeeklyDigestAt" TIMESTAMP(3),
    "lastTransactionsQuery" JSONB,
    "postCheckoutBalanceSentAt" TIMESTAMP(3),
    "lastBalanceUpdateAt" TIMESTAMP(3),
    "welcomeSentAt" TIMESTAMP(3),
    "lowBalanceThreshold" DOUBLE PRECISION DEFAULT 100,
    "lastLowBalanceAlertAt" TIMESTAMP(3),
    "pendingJobType" TEXT,
    "pendingJobAskedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlaidItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionName" TEXT,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlaidAccount" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "availableBalance" DOUBLE PRECISION,
    "currency" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "mask" TEXT,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "subtype" TEXT,
    "type" TEXT NOT NULL,

    CONSTRAINT "PlaidAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT DEFAULT 'blooio',
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MagicLink" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "sentiment" TEXT,
    "context" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "public"."PlaidItem"("itemId");

-- CreateIndex
CREATE INDEX "PlaidItem_userId_idx" ON "public"."PlaidItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidAccount_accountId_key" ON "public"."PlaidAccount"("accountId");

-- CreateIndex
CREATE INDEX "PlaidAccount_itemId_idx" ON "public"."PlaidAccount"("itemId");

-- CreateIndex
CREATE INDEX "Message_userId_sentAt_idx" ON "public"."Message"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_expiresAt_idx" ON "public"."Message"("expiresAt");

-- CreateIndex
CREATE INDEX "MagicLink_expiresAt_idx" ON "public"."MagicLink"("expiresAt");

-- CreateIndex
CREATE INDEX "MagicLink_used_expiresAt_idx" ON "public"."MagicLink"("used", "expiresAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "public"."Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_resolved_idx" ON "public"."Feedback"("resolved");

-- AddForeignKey
ALTER TABLE "public"."PlaidItem" ADD CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaidAccount" ADD CONSTRAINT "PlaidAccount_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

