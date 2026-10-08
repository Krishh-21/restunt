const sendMail = jest.fn(),
  close = jest.fn();
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail, close }) },
}));
jest.mock('../lib/prisma', () => ({
  prisma: {
    notificationDelivery: { findUnique: jest.fn(), update: jest.fn() },
    notificationPreference: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));
import { prisma } from '../lib/prisma';
import { deliverNotification } from './notificationService';
const db = prisma as any;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_FROM = 'alerts@example.com';
  db.notificationDelivery.findUnique.mockResolvedValue({
    id: 'message',
    tenantId: 'restaurant',
    outletId: 'outlet',
    userId: 'staff',
    event: 'stock:low',
    title: 'Low stock',
    body: 'Remaining 2',
    channels: ['EMAIL'],
    emailSentAt: null,
  });
  db.user.findFirst.mockResolvedValue({ email: 'manager@example.com' });
  db.notificationPreference.findUnique.mockResolvedValue({
    email: true,
    push: false,
    events: ['stock:low'],
  });
  sendMail.mockResolvedValue({});
});
afterAll(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_FROM;
});
test('records delivery only after SMTP succeeds', async () => {
  await deliverNotification('message');
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({ to: 'manager@example.com', subject: 'Low stock' })
  );
  expect(db.notificationDelivery.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { emailSentAt: expect.any(Date) } })
  );
  expect(close).toHaveBeenCalled();
});
test('SMTP failure retains undelivered record for retry', async () => {
  sendMail.mockRejectedValueOnce(new Error('temporary failure'));
  await expect(deliverNotification('message')).rejects.toThrow('temporary failure');
  expect(db.notificationDelivery.update).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
test('unsubscribed events and inactive users never send', async () => {
  db.notificationPreference.findUnique.mockResolvedValueOnce({ email: true, events: [] });
  await deliverNotification('message');
  expect(sendMail).not.toHaveBeenCalled();
  db.user.findFirst.mockResolvedValueOnce(null);
  await deliverNotification('message');
  expect(sendMail).not.toHaveBeenCalled();
});
test('acknowledged email is not sent again', async () => {
  db.notificationDelivery.findUnique.mockResolvedValueOnce({
    id: 'message',
    tenantId: 'restaurant',
    outletId: 'outlet',
    userId: 'staff',
    event: 'stock:low',
    channels: ['EMAIL'],
    emailSentAt: new Date(),
  });
  await deliverNotification('message');
  expect(sendMail).not.toHaveBeenCalled();
});
