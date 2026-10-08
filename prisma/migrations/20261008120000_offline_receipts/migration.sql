-- CreateTable
CREATE TABLE "tenant"."SyncOperation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."NotificationPreference" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "push" BOOLEAN NOT NULL DEFAULT false,
    "events" TEXT[],
    "pushTokens" TEXT[],

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."NotificationDelivery" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT[],
    "emailSentAt" TIMESTAMP(3),
    "pushSentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_tenant_id_outlet_id_operation_id_key" ON "tenant"."SyncOperation"("tenant_id", "outlet_id", "operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_tenant_id_user_id_key" ON "tenant"."NotificationPreference"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenant_id_user_id_createdAt_idx" ON "tenant"."NotificationDelivery"("tenant_id", "user_id", "createdAt");
