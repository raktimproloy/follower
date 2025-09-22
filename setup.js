#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Follower API...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const configEnvPath = path.join(__dirname, 'config.env');

if (!fs.existsSync(envPath) && fs.existsSync(configEnvPath)) {
  console.log('📝 Creating .env file from config.env...');
  fs.copyFileSync(configEnvPath, envPath);
  console.log('✅ .env file created successfully\n');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Generate Prisma client
console.log('🔧 Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully\n');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  console.log('💡 Make sure your DATABASE_URL is correct in the .env file\n');
}

console.log('🎉 Setup completed!');
console.log('\n📋 Next steps:');
console.log('1. Update your .env file with correct database credentials');
console.log('2. Create your MySQL database');
console.log('3. Run: npm run db:push (to create database tables)');
console.log('4. Run: npm run dev (to start the development server)');
console.log('\n📖 Check README.md for detailed instructions');
