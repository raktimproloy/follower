const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateNotificationId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Notification ID is required'),
  handleValidationErrors
];

// Validation for creating notification
const validateCreateNotification = [
  body('type')
    .isIn(['like', 'comment', 'follow', 'share', 'story_like', 'story_view'])
    .withMessage('Invalid notification type'),
  body('message')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  handleValidationErrors
];

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification for a user
 * @access  Public (no authentication required)
 */
router.post('/', validateCreateNotification, async (req, res) => {
  try {
    const { userId, type, message } = req.body;

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Target user not found'
      });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        message
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true
          }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Notification created successfully',
      data: {
        notification
      }
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create notification'
    });
  }
});

/**
 * @route   GET /api/notifications
 * @desc    Get current user's notifications with pagination
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count
    const totalNotifications = await prisma.notification.count({
      where: { userId }
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total: totalNotifications,
          pages: Math.ceil(totalNotifications / limit)
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notifications'
    });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (only notification owner)
 */
router.put('/:id/read', authenticateToken, validateNotificationId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    // Mark as read
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: {
        notification: updatedNotification
      }
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all user's notifications as read
 * @access  Private
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Mark all as read
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: { isRead: true }
    });

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private (only notification owner)
 */
router.delete('/:id', authenticateToken, validateNotificationId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id }
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
});

module.exports = router;
