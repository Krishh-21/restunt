import nodemailer from 'nodemailer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { emitToOutlet } from '../lib/socket';
export async function notifyManagers(
  tenantId: string,
  outletId: string,
  event: string,
  title: string,
  body: string
) {
  const staff = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
      outletAssignments: { has: outletId },
    },
    select: { id: true },
  });
  for (const user of staff) {
    const preference = await prisma.notificationPreference.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (preference && !preference.events.includes(event)) continue;
    await prisma.notificationDelivery.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        event,
        title,
        body,
        channels: [
          ...(preference?.email && process.env.SMTP_HOST ? ['EMAIL'] : []),
          ...(preference?.push && process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? ['PUSH'] : []),
        ],
      },
    });
  }
  emitToOutlet(tenantId, outletId, 'notification:new', { event, title, body });
}
export async function deliverNotification(id: string) {
  const row = await prisma.notificationDelivery.findUnique({ where: { id } });
  if (!row) return { skipped: true };
  const user = await prisma.user.findFirst({
    where: {
      id: row.userId,
      tenantId: row.tenantId,
      isActive: true,
      outletAssignments: { has: row.outletId },
    },
  });
  if (!user) return { skipped: true };
  const preference = await prisma.notificationPreference.findUnique({
    where: { tenantId_userId: { tenantId: row.tenantId, userId: row.userId } },
  });
  if (!preference?.events.includes(row.event)) return { skipped: true };
  if (row.channels.includes('EMAIL') && !row.emailSentAt && preference.email) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error('SMTP is not configured');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.NODE_ENV === 'production' && process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 15000,
      socketTimeout: 20000,
    });
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: row.title,
        text: row.body,
        messageId: row.id + '@dinely.local',
      });
    } finally {
      transport.close();
    }
    await prisma.notificationDelivery.update({
      where: { id: row.id },
      data: { emailSentAt: new Date() },
    });
  }
  if (row.channels.includes('PUSH') && !row.pushSentAt && preference.push) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) throw new Error('Firebase is not configured');
    if (!getApps().length)
      initializeApp({
        credential: cert(
          JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
        ),
      });
    if (preference.pushTokens.length) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: preference.pushTokens,
        notification: { title: row.title, body: row.body },
        data: { notificationId: row.id, event: row.event },
      });
      const invalid = preference.pushTokens.filter((_, index) =>
        [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token',
        ].includes(result.responses[index].error?.code ?? '')
      );
      if (invalid.length)
        await prisma.notificationPreference.update({
          where: { id: preference.id },
          data: { pushTokens: preference.pushTokens.filter((token) => !invalid.includes(token)) },
        });
      if (
        result.responses.some(
          (response) =>
            !response.success &&
            ![
              'messaging/registration-token-not-registered',
              'messaging/invalid-registration-token',
            ].includes(response.error?.code ?? '')
        )
      )
        throw new Error('Some push messages failed; retry required');
    }
    await prisma.notificationDelivery.update({
      where: { id: row.id },
      data: { pushSentAt: new Date() },
    });
  }
  return { delivered: true };
}
