const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
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

const validateStoryId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Story ID is required'),

  handleValidationErrors
];

// Simple image URL middleware for stories
const processImages = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  // Just set the URL for the uploaded file
  req.file.url = `/uploads/images/${req.file.filename}`;
  next();
};

/**
 * @route   POST /api/stories
 * @desc    Create new story (image only)
 * @access  Private
 */
router.post('/', authenticateToken, upload.single('image'), processImages, handleUploadError, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Image is required'
      });
    }

    // Create story with 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const story = await prisma.story.create({
      data: {
        userId,
        imageUrl: req.file.url,
        expiresAt
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        _count: {
          select: {
            likes: true,
            views: true
          }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Story created successfully',
      data: {
        story: {
          ...story,
          likesCount: story._count.likes,
          viewsCount: story._count.views
        }
      }
    });

  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create story'
    });
  }
});

/**
 * @route   POST /api/stories/:id/view
 * @desc    Add view to story (only if not already viewed)
 * @access  Private
 */
router.post('/:id/view', authenticateToken, validateStoryId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if story exists
    const story = await prisma.story.findUnique({
      where: { id }
    });

    if (!story) {
      return res.status(404).json({
        status: 'error',
        message: 'Story not found'
      });
    }

    // Check if user already viewed the story
    const existingView = await prisma.story.findFirst({
      where: {
        id,
        views: {
          some: { id: userId }
        }
      }
    });

    if (existingView) {
      return res.status(200).json({
        status: 'success',
        message: 'Story already viewed',
        action: 'already_viewed'
      });
    }

    // Add view to the story
    await prisma.story.update({
      where: { id },
      data: {
        views: {
          connect: { id: userId }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Story viewed successfully',
      action: 'viewed'
    });

  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to view story'
    });
  }
});

/**
 * @route   GET /api/stories/following
 * @desc    Get stories from users that the current user is following
 * @access  Private
 */
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get users that the current user is following
    const userFollowing = await prisma.user.findUnique({
      where: { id: userId },
      select: { following: { select: { id: true } } }
    });

    if (!userFollowing || userFollowing.following.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          stories: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        }
      });
    }

    const followingIds = userFollowing.following.map(user => user.id);

    // Get stories uploaded within the last 24 hours from followed users
    const stories = await prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        createdAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        _count: {
          select: {
            likes: true,
            views: true
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
    const totalStories = await prisma.story.count({
      where: {
        userId: { in: followingIds },
        createdAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    // Transform stories to include like status for current user
    const transformedStories = await Promise.all(
      stories.map(async (story) => {
        const isLiked = await prisma.story.findFirst({
          where: {
            id: story.id,
            likes: {
              some: { id: userId }
            }
          }
        });

        return {
          id: story.id,
          imageUrl: story.imageUrl,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          user: story.user,
          stats: {
            likesCount: story._count.likes,
            viewsCount: story._count.views
          },
          isLiked: !!isLiked
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        stories: transformedStories,
        pagination: {
          page,
          limit,
          total: totalStories,
          pages: Math.ceil(totalStories / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get following stories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get following stories'
    });
  }
});

/**
 * @route   GET /api/stories/my
 * @desc    Get current user's stories
 * @access  Private
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stories = await prisma.story.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        _count: {
          select: {
            likes: true,
            views: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        stories: stories.map(story => ({
          id: story.id,
          imageUrl: story.imageUrl,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          stats: {
            likesCount: story._count.likes,
            viewsCount: story._count.views
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get your stories'
    });
  }
});

/**
 * @route   PUT /api/stories/:id
 * @desc    Update story (only image)
 * @access  Private (only story owner)
 */
router.put('/:id', authenticateToken, validateStoryId, upload.single('image'), processImages, handleUploadError, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if story exists and user owns it
    const existingStory = await prisma.story.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingStory) {
      return res.status(404).json({
        status: 'error',
        message: 'Story not found or you do not have permission to update it'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Image is required'
      });
    }

    // Update story
    const updatedStory = await prisma.story.update({
      where: { id },
      data: {
        imageUrl: req.file.url
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        _count: {
          select: {
            likes: true,
            views: true
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Story updated successfully',
      data: {
        story: {
          ...updatedStory,
          likesCount: updatedStory._count.likes,
          viewsCount: updatedStory._count.views
        }
      }
    });

  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update story'
    });
  }
});

/**
 * @route   DELETE /api/stories/:id
 * @desc    Delete story
 * @access  Private (only story owner)
 */
router.delete('/:id', authenticateToken, validateStoryId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if story exists and user owns it
    const existingStory = await prisma.story.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingStory) {
      return res.status(404).json({
        status: 'error',
        message: 'Story not found or you do not have permission to delete it'
      });
    }

    // Delete story
    await prisma.story.delete({
      where: { id }
    });

    res.status(200).json({
      status: 'success',
      message: 'Story deleted successfully'
    });

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete story'
    });
  }
});

/**
 * @route   POST /api/stories/:id/like
 * @desc    Like/unlike story
 * @access  Private
 */
router.post('/:id/like', authenticateToken, validateStoryId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if story exists
    const story = await prisma.story.findUnique({
      where: { id }
    });

    if (!story) {
      return res.status(404).json({
        status: 'error',
        message: 'Story not found'
      });
    }

    // Check if user already liked the story
    const existingLike = await prisma.story.findFirst({
      where: {
        id,
        likes: {
          some: { id: userId }
        }
      }
    });

    if (existingLike) {
      // Unlike the story
      await prisma.story.update({
        where: { id },
        data: {
          likes: {
            disconnect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Story unliked',
        action: 'unliked'
      });
    } else {
      // Like the story
      await prisma.story.update({
        where: { id },
        data: {
          likes: {
            connect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Story liked',
        action: 'liked'
      });
    }

  } catch (error) {
    console.error('Like story error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to like/unlike story'
    });
  }
});

module.exports = router;
