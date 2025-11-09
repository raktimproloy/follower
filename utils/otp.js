const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Create transporter for SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  const otp = crypto.randomInt(100000, 999999).toString();
  console.log(`[DEBUG] OTP: Generated OTP for ${otp.length} digits`);
  return otp;
}

/**
 * Send OTP via email
 */
async function sendOTP(email, otp, type) {
  const subject = type === 'registration' ? 'Verify Your Email' : 'Reset Your Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Your OTP code is:</p>
      <div style="font-size: 24px; font-weight: bold; color: #007bff; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject,
    html,
  };

  console.log(`[DEBUG] OTP: Sending ${type} OTP to ${email}`);
  await transporter.sendMail(mailOptions);
  console.log(`[DEBUG] OTP: OTP sent successfully to ${email}`);
}

/**
 * Store OTP in database
 */
async function storeOTP(email, otp, type) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  console.log(`[DEBUG] OTP: Storing ${type} OTP for ${email}, expires at ${expiresAt}`);
  await prisma.user.update({
    where: { email },
    data: {
      otpCode: otp,
      otpType: type,
      otpExpiresAt: expiresAt,
      otpUsed: false,
    },
  });
  console.log(`[DEBUG] OTP: OTP stored successfully for ${email}`);
}

/**
 * Verify OTP
 */
async function verifyOTP(email, otp, type) {
  console.log(`[DEBUG] OTP: Verifying ${type} OTP for ${email}`);
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.otpCode !== otp || user.otpType !== type || user.otpUsed || user.otpExpiresAt <= new Date()) {
    console.log(`[DEBUG] OTP: OTP verification failed for ${email}`);
    return false;
  }

  // Mark OTP as used
  await prisma.user.update({
    where: { email },
    data: { otpUsed: true },
  });

  console.log(`[DEBUG] OTP: OTP verification successful for ${email}`);
  return true;
}

/**
 * Clean up expired OTPs (can be called periodically)
 */
async function cleanupExpiredOTPs() {
  await prisma.user.updateMany({
    where: {
      otpExpiresAt: {
        lt: new Date(),
      },
    },
    data: {
      otpCode: null,
      otpType: null,
      otpExpiresAt: null,
      otpUsed: false,
    },
  });
}

module.exports = {
  generateOTP,
  sendOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
};
