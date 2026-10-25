require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');

const seedData = async () => {
  console.log('🌱 Starting database seeding...');

  try {
    await connectDB();

    // Clear existing collections for a clean seed
    await Promise.all([
      User.deleteMany({}),
      Item.deleteMany({}),
      Claim.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('🧹 Cleared existing data.');

    // 1. Create Users
    const adminPasswordHash = await User.hashPassword('Admin@123456');
    const userPasswordHash = await User.hashPassword('User@123456');

    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@example.com',
      phone: '+1 555-0100',
      passwordHash: adminPasswordHash,
      role: 'admin',
      accountStatus: 'active',
    });

    const user1 = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah@example.com',
      phone: '+1 555-0145',
      passwordHash: userPasswordHash,
      role: 'user',
      accountStatus: 'active',
    });

    const user2 = await User.create({
      name: 'Alex Rivera',
      email: 'alex@example.com',
      phone: '+1 555-0182',
      passwordHash: userPasswordHash,
      role: 'user',
      accountStatus: 'active',
    });

    console.log('✅ Created 3 users (1 Admin, 2 Regular Users).');

    // 2. Create Items (Lost & Found)
    const items = await Item.create([
      {
        title: 'Space Grey MacBook Air M2 13-inch',
        type: 'lost',
        category: 'Electronics',
        description: 'Lost my 13-inch MacBook Air in a dark grey protective neoprene sleeve. It has a tiny NASA sticker on the top right corner.',
        location: 'Campus Central Library, 2nd Floor Silent Study Area',
        itemDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        reportedBy: user1._id,
        status: 'active',
        additionalPrivateNotes: 'Serial number ends in M2Q4. Lock code hint: favorite pet.',
      },
      {
        title: 'Apple MacBook Air Laptop (Space Grey)',
        type: 'found',
        category: 'Electronics',
        description: 'Found a space grey Apple laptop left on a corner table with charger in the library.',
        location: 'Central Library 2nd Floor study desks',
        itemDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        reportedBy: user2._id,
        status: 'active',
        additionalPrivateNotes: 'Handed over temporarily to campus front security desk, locker #4.',
      },
      {
        title: 'Brown Leather Fossil Bi-Fold Wallet',
        type: 'lost',
        category: 'Wallets and Purses',
        description: 'Vintage brown leather wallet containing university ID and driver license. Great sentimental value.',
        location: 'Student Dining Hall / Cafeteria booth #8',
        itemDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        reportedBy: user2._id,
        status: 'active',
        additionalPrivateNotes: 'Contains an old family photograph in inner pocket.',
      },
      {
        title: 'Student ID Card - Engineering Department',
        type: 'found',
        category: 'Identity Cards',
        description: 'Found a blue plastic university ID card with lanyard near the main entrance stairs.',
        location: 'Main Science & Engineering Quad Entrance',
        itemDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        reportedBy: user1._id,
        status: 'resolved',
        additionalPrivateNotes: 'Student ID # ending with 8921. Returned to student affair desk.',
      },
      {
        title: 'Sony WH-1000XM4 Wireless Headphones (Black)',
        type: 'found',
        category: 'Electronics',
        description: 'Over-ear black Sony noise cancelling headphones found inside gym locker room.',
        location: 'Sports & Aquatic Recreation Center Locker 32',
        itemDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        reportedBy: user1._id,
        status: 'active',
        additionalPrivateNotes: 'Bluetooth name was "Sarah Phone".',
      },
      {
        title: 'Silver Car Keys with Subaru Fob and Brass Ring',
        type: 'lost',
        category: 'Keys',
        description: 'Lost my car keys with a black Subaru key fob, gym barcode tag, and brass carabiner.',
        location: 'North Visitor Parking Lot B',
        itemDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        reportedBy: user2._id,
        status: 'active',
        additionalPrivateNotes: 'Has an orange gym pass tag.',
      },
    ]);

    console.log(`✅ Created ${items.length} sample items.`);

    // 3. Create a Claim
    const claim = await Claim.create({
      item: items[1]._id, // The found laptop
      claimant: user1._id, // Sarah claims it
      explanation: 'This matches my lost laptop! It is a 13-inch M2 MacBook Air with a small NASA sticker on the top right, serial ending M2Q4. I can provide purchase invoice.',
      status: 'pending',
    });

    await Item.findByIdAndUpdate(items[1]._id, { claimCount: 1 });

    // 4. Create sample Notification
    await Notification.create({
      recipient: user2._id,
      message: `${user1.name} submitted an ownership claim for your reported item "${items[1].title}". Please review it.`,
      type: 'claim_submitted',
      relatedItem: items[1]._id,
      relatedClaim: claim._id,
      isRead: false,
    });

    console.log('✅ Created sample claim and notification.');
    console.log('======================================================');
    console.log('🌱 Seeding complete! Credentials to log in:');
    console.log('   Admin:  admin@example.com  / Admin@123456');
    console.log('   User 1: sarah@example.com  / User@123456');
    console.log('   User 2: alex@example.com   / User@123456');
    console.log('======================================================');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

seedData();
