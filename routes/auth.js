const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { generateOTP, sendOTP, storeOTP, verifyOTP } = require('../utils/otp');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/auth/register/initiate
 * @desc    Initiate user registration by checking user existence and sending OTP
 * @access  Public
 */
router.post('/register/initiate', async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    // Validate required fields
    if (!fullname || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Fullname, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    console.log(`[DEBUG] Registration initiate: Checking user existence for ${email}`);

    if (existingUser) {
      console.log(`[DEBUG] Registration initiate: User exists, verified: ${existingUser.isVerified}`);
      if (existingUser.isVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'User already registered'
        });
      } else {
        // User exists but not verified, send OTP
        console.log(`[DEBUG] Registration initiate: Sending OTP for existing unverified user`);
        const otp = generateOTP();
        await storeOTP(email, otp, 'registration');
        await sendOTP(email, otp, 'registration');

        return res.status(200).json({
          status: 'success',
          message: 'OTP sent to your email. Please verify to complete registration.'
        });
      }
    }

    // User does not exist, create user and send OTP
    console.log(`[DEBUG] Registration initiate: Creating new user for ${email}`);
    const hashedPassword = await hashPassword(password);

    await prisma.user.create({
      data: {
        fullname,
        email,
        password: hashedPassword,
        isVerified: false
      }
    });

    console.log(`[DEBUG] Registration initiate: User created, sending OTP`);
    const otp = generateOTP();
    await storeOTP(email, otp, 'registration');
    await sendOTP(email, otp, 'registration');

    res.status(200).json({
      status: 'success',
      message: 'User created and OTP sent to your email. Please verify to complete registration.'
    });

  } catch (error) {
    console.error('Registration initiation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate registration'
    });
  }
});

/**
 * @route   POST /api/auth/register/verify
 * @desc    Verify OTP and complete registration
 * @access  Public
 */
router.post('/register/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and OTP are required'
      });
    }

    // Verify OTP
    const isValidOTP = await verifyOTP(email, otp, 'registration');
    if (!isValidOTP) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Update user to verified
    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
      select: {
        id: true,
        fullname: true,
        email: true,
        profilePicture: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete registration'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    console.log(`[DEBUG] Login: Checking user existence for ${email}`);

    if (!user) {
      console.log(`[DEBUG] Login: User not found`);
      return res.status(404).json({
        status: 'error',
        message: 'User not exist'
      });
    }

    console.log(`[DEBUG] Login: User found, verified: ${user.isVerified}`);

    if (!user.isVerified) {
      // User exists but not verified, send OTP
      console.log(`[DEBUG] Login: Sending OTP for unverified user`);
      const otp = generateOTP();
      await storeOTP(email, otp, 'registration');
      await sendOTP(email, otp, 'registration');

      return res.status(200).json({
        status: 'success',
        message: 'Email not verified. OTP sent to your email. Please verify to login.'
      });
    }

    // Check password
    console.log(`[DEBUG] Login: Validating password`);
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.log(`[DEBUG] Login: Invalid password`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    console.log(`[DEBUG] Login: Password valid, generating token`);

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Return user data (excluding password)
    const userData = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log(`[DEBUG] Login: Login successful for ${email}`);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: userData,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to login'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
  // Since we're using stateless JWT, logout is handled client-side
  // by removing the token from storage
  res.status(200).json({
    status: 'success',
    message: 'Logout successful'
  });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate forgot password by sending OTP
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    await storeOTP(email, otp, 'forgot_password');
    await sendOTP(email, otp, 'forgot_password');

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to your email. Please verify to reset your password.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate password reset'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Verify OTP and reset password
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, OTP, and new password are required'
      });
    }

    // Verify OTP
    const isValidOTP = await verifyOTP(email, otp, 'forgot_password');
    if (!isValidOTP) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user with follower/following counts
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullname: true,
        email: true,
        profilePicture: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            followers: true,
            following: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          followersCount: user._count.followers,
          followingCount: user._count.following
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user profile'
    });
  }
});

module.exports = router;
