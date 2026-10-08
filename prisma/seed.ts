import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function demoId(value: string) {
  const hex = createHash('sha256').update(value).digest('hex');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-4' +
    hex.slice(13, 16) +
    '-a' +
    hex.slice(17, 20) +
    '-' +
    hex.slice(20, 32)
  );
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  console.log('🌱 Starting database seeding...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      id: demoId('demo-tenant-id'),
      name: 'Demo Restaurant',
      subdomain: 'demo',
      logo: null,
      gstin: '12ABCDE1234F1Z5',
      subscriptionTier: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      settings: {
        loyaltyPointsRate: 0.01, // 1 point per 100 rupees
        serviceChargePercent: 10,
        taxRates: [{ category: 'food', cgst: 2.5, sgst: 2.5 }],
      },
    },
  });

  console.log('✅ Created demo tenant:', tenant.name);

  // Create demo outlet
  const outlet = await prisma.outlet.upsert({
    where: { id: demoId('demo-outlet-id') },
    update: {},
    create: {
      id: demoId('demo-outlet-id'),
      tenantId: tenant.id,
      name: 'Main Branch',
      address: '123 Main Street, Mumbai, Maharashtra 400001',
      phone: '+91 98765 43210',
      email: 'main@demorestaurant.com',
      type: 'DINE_IN',
      openTime: '09:00',
      closeTime: '23:00',
      settings: {
        serviceChargePercent: 10,
        taxRates: [{ category: 'food', cgst: 2.5, sgst: 2.5 }],
        tablePrefix: 'T',
      },
    },
  });

  console.log('✅ Created demo outlet:', outlet.name, outlet.id);

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminPinHash = await bcrypt.hash('1234', 10);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username: 'admin',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      username: 'admin',
      email: 'admin@demorestaurant.com',
      phone: '+91 98765 43211',
      passwordHash: adminPasswordHash,
      pinHash: adminPinHash,
      fullName: 'Restaurant Admin',
      role: 'ADMIN',
      outletAssignments: [outlet.id],
    },
  });

  console.log('✅ Created admin user:', adminUser.username);

  // Create demo tables
  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const table = await prisma.table.upsert({
      where: { id: demoId(`demo-table-${i}`) },
      update: {},
      create: {
        id: demoId(`demo-table-${i}`),
        tenantId: tenant.id,
        outletId: outlet.id,
        number: `T${i.toString().padStart(2, '0')}`,
        name: `Table ${i}`,
        capacity: i <= 6 ? 4 : i <= 8 ? 6 : 8,
        section: i <= 5 ? 'Indoor' : 'Outdoor',
        qrCodeUrl: `http://localhost:3003/?outletId=${outlet.id}&tableId=${demoId(`demo-table-${i}`)}`,
        floorPlanPosition: {
          x: (i % 3) * 100 + 50,
          y: Math.floor((i - 1) / 3) * 100 + 50,
          shape: 'rectangle',
        },
      },
    });
    tables.push(table);
  }

  console.log(`✅ Created ${tables.length} demo tables`);

  // Create menu categories
  const categories = [
    { name: 'Starters', displayOrder: 1 },
    { name: 'Main Course', displayOrder: 2 },
    { name: 'Beverages', displayOrder: 3 },
    { name: 'Desserts', displayOrder: 4 },
  ];

  const createdCategories = [];
  for (const category of categories) {
    const menuCategory = await prisma.menuCategory.upsert({
      where: { id: demoId(`demo-category-${category.name.toLowerCase().replace(' ', '-')}`) },
      update: {},
      create: {
        id: demoId(`demo-category-${category.name.toLowerCase().replace(' ', '-')}`),
        tenantId: tenant.id,
        outletId: outlet.id,
        name: category.name,
        displayOrder: category.displayOrder,
        taxCategory: 'food',
      },
    });
    createdCategories.push(menuCategory);
  }

  console.log(`✅ Created ${createdCategories.length} menu categories`);

  // Create sample menu items
  const menuItems = [
    {
      categoryId: createdCategories[0].id, // Starters
      name: 'Paneer Tikka',
      description: 'Grilled cottage cheese with Indian spices',
      price: 299,
      costPrice: 120,
      tags: ['vegetarian', 'spicy'],
      preparationTimeMinutes: 15,
    },
    {
      categoryId: createdCategories[0].id, // Starters
      name: 'Chicken Wings',
      description: 'Spicy buffalo chicken wings',
      price: 399,
      costPrice: 180,
      tags: ['spicy'],
      preparationTimeMinutes: 20,
    },
    {
      categoryId: createdCategories[1].id, // Main Course
      name: 'Butter Chicken',
      description: 'Creamy tomato-based curry with tender chicken',
      price: 499,
      costPrice: 220,
      tags: ['popular'],
      preparationTimeMinutes: 25,
    },
    {
      categoryId: createdCategories[1].id, // Main Course
      name: 'Dal Makhani',
      description: 'Rich and creamy black lentils',
      price: 329,
      costPrice: 100,
      tags: ['vegetarian', 'popular'],
      preparationTimeMinutes: 20,
    },
    {
      categoryId: createdCategories[2].id, // Beverages
      name: 'Masala Chai',
      description: 'Traditional Indian spiced tea',
      price: 79,
      costPrice: 15,
      tags: ['hot', 'vegetarian'],
      preparationTimeMinutes: 5,
    },
    {
      categoryId: createdCategories[3].id, // Desserts
      name: 'Gulab Jamun',
      description: 'Sweet milk dumplings in sugar syrup',
      price: 149,
      costPrice: 40,
      tags: ['vegetarian', 'sweet'],
      preparationTimeMinutes: 10,
    },
  ];

  const createdMenuItems = [];
  for (const item of menuItems) {
    const menuItem = await prisma.menuItem.upsert({
      where: { id: demoId(`demo-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`) },
      update: {},
      create: {
        id: demoId(`demo-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`),
        tenantId: tenant.id,
        outletId: outlet.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        costPrice: item.costPrice,
        tags: item.tags,
        preparationTimeMinutes: item.preparationTimeMinutes,
        modifiers: {
          spiceLevel: {
            name: 'Spice Level',
            type: 'SINGLE',
            required: false,
            options: [
              { name: 'Mild', priceAdjustment: 0 },
              { name: 'Medium', priceAdjustment: 0 },
              { name: 'Hot', priceAdjustment: 0 },
            ],
          },
        },
      },
    });
    createdMenuItems.push(menuItem);
  }

  console.log(`✅ Created ${createdMenuItems.length} menu items`);

  // Create sample inventory items
  const inventoryItems = [
    {
      name: 'Chicken (Fresh)',
      category: 'meats',
      unitOfMeasure: 'kg',
      currentQuantity: 50,
      minimumThreshold: 10,
      reorderQuantity: 100,
      cost: 280,
    },
    {
      name: 'Paneer',
      category: 'dairy',
      unitOfMeasure: 'kg',
      currentQuantity: 20,
      minimumThreshold: 5,
      reorderQuantity: 50,
      cost: 350,
    },
    {
      name: 'Tomatoes',
      category: 'vegetables',
      unitOfMeasure: 'kg',
      currentQuantity: 30,
      minimumThreshold: 8,
      reorderQuantity: 80,
      cost: 40,
    },
    {
      name: 'Onions',
      category: 'vegetables',
      unitOfMeasure: 'kg',
      currentQuantity: 40,
      minimumThreshold: 10,
      reorderQuantity: 100,
      cost: 25,
    },
    {
      name: 'Rice (Basmati)',
      category: 'dry-goods',
      unitOfMeasure: 'kg',
      currentQuantity: 100,
      minimumThreshold: 20,
      reorderQuantity: 200,
      cost: 120,
    },
    {
      name: 'Tea Leaves',
      category: 'beverages',
      unitOfMeasure: 'kg',
      currentQuantity: 5,
      minimumThreshold: 1,
      reorderQuantity: 10,
      cost: 800,
    },
  ];

  const createdInventoryItems = [];
  for (const item of inventoryItems) {
    const inventoryItem = await prisma.inventoryItem.upsert({
      where: {
        id: demoId(
          `demo-inventory-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`
        ),
      },
      update: {},
      create: {
        id: demoId(
          `demo-inventory-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`
        ),
        tenantId: tenant.id,
        outletId: outlet.id,
        name: item.name,
        category: item.category,
        unitOfMeasure: item.unitOfMeasure,
        currentQuantity: item.currentQuantity,
        minimumThreshold: item.minimumThreshold,
        reorderQuantity: item.reorderQuantity,
        weightedAverageCost: item.cost,
      },
    });
    createdInventoryItems.push(inventoryItem);
  }

  console.log(`✅ Created ${createdInventoryItems.length} inventory items`);

  // Create sample customer
  const customer = await prisma.customer.upsert({
    where: {
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '+919876500001',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'John Doe',
      phone: '+919876500001',
      email: 'john.doe@example.com',
      loyaltyTier: 'SILVER',
      loyaltyPoints: 150,
      lifetimeValue: 2500,
      orderCount: 12,
      tags: ['regular-customer', 'prefers-mild-spice'],
      whatsappOptIn: true,
      emailOptIn: true,
    },
  });

  console.log('✅ Created demo customer:', customer.name);

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('  PIN: 1234');
  console.log('');
  console.log('Demo tenant:');
  console.log('  Subdomain: demo');
  console.log('  Name: Demo Restaurant');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
