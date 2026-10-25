require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const createAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'Portal Administrator';

  console.log('🔧 Initializing Administrator Setup...');

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (existingAdmin) {
      console.log(`ℹ️  User with email "${adminEmail}" already exists.`);
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        existingAdmin.accountStatus = 'active';
        await existingAdmin.save();
        console.log(`✅ Promoted existing user "${existingAdmin.name}" to Administrator.`);
      } else {
        console.log('✅ User is already configured as Administrator.');
      }
    } else {
      const passwordHash = await User.hashPassword(adminPassword);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail.toLowerCase(),
        phone: '+1 555-0199',
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
      });
      console.log('======================================================');
      console.log('✅ Administrator account created successfully:');
      console.log(`   Email:    ${newAdmin.email}`);
      console.log(`   Role:     ${newAdmin.role}`);
      console.log(`   Name:     ${newAdmin.name}`);
      console.log('======================================================');
    }
  } catch (error) {
    console.error('❌ Error creating administrator account:', error.message);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

createAdmin();
