const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { upload, processImages, handleUploadError } = require('../middleware/upload');
const { body, param, query, validationResult } = require('express-validator');

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

// Validation rules
const validatePost = [
  body('visibility')
    .optional()
    .isIn(['public', 'friends', 'private'])
    .withMessage('Visibility must be public, friends, or private'),
  
  handleValidationErrors
];

const validatePostId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Post ID is required'),
  
  handleValidationErrors
];

/**
 * @route   POST /api/posts
 * @desc    Create new post
 * @access  Private
 */
router.post('/', authenticateToken, upload.array('media', 5), processImages, validatePost, handleUploadError, async (req, res) => {
  try {
    const { content, visibility = 'public' } = req.body;
    const userId = req.user.id;

    // Create post
    const post = await prisma.post.create({
      data: {
        userId,
        content,
        visibility,
        media: {
          create: req.files?.map(file => ({
            type: 'image',
            url: file.url
          })) || []
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
        media: true,
        _count: {
          select: {
            likes: true,
            shares: true
          }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: {
        post: {
          ...post,
          likesCount: post._count.likes,
          sharesCount: post._count.shares
        }
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create post'
    });
  }
});

/**
 * @route   GET /api/posts
 * @desc    Get timeline posts
 * @access  Public (with optional auth for personalized timeline)
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id;

    // Build where clause based on visibility and user authentication
    let whereClause = {
      visibility: 'public'
    };

    // If user is authenticated, show their posts and friends' posts
    if (currentUserId) {
      const userFollowing = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { following: { select: { id: true } } }
      });

      const followingIds = userFollowing?.following.map(user => user.id) || [];

      whereClause = {
        OR: [
          { visibility: 'public' },
          { userId: currentUserId },
          {
            AND: [
              { visibility: 'friends' },
              { userId: { in: followingIds } }
            ]
          }
        ]
      };
    }

    // Get posts with pagination
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        media: true,
        _count: {
          select: {
            likes: true,
            shares: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Check if current user liked each post
    const postsWithLikes = await Promise.all(
      posts.map(async (post) => {
        let isLiked = false;
        if (currentUserId) {
          const like = await prisma.post.findFirst({
            where: {
              id: post.id,
              likes: {
                some: { id: currentUserId }
              }
            }
          });
          isLiked = !!like;
        }

        return {
          ...post,
          likesCount: post._count.likes,
          sharesCount: post._count.shares,
          isLiked
        };
      })
    );

    // Get total count
    const totalPosts = await prisma.post.count({
      where: whereClause
    });

    res.status(200).json({
      status: 'success',
      data: {
        posts: postsWithLikes,
        pagination: {
          page,
          limit,
          total: totalPosts,
          pages: Math.ceil(totalPosts / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get posts'
    });
  }
});


/**
 * @route   GET /api/posts/following
 * @desc    Get posts from users that the current user is following
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
          posts: [],
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

    // Get posts from followed users with public or friends visibility
    const posts = await prisma.post.findMany({
      where: {
        userId: { in: followingIds },
        OR: [
          { visibility: 'public' },
          { visibility: 'friends' }
        ]
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
        media: true,
        _count: {
          select: {
            likes: true,
            comments: {
              where: { parentComment: null }
            },
            shares: true
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
    const totalPosts = await prisma.post.count({
      where: {
        userId: { in: followingIds },
        OR: [
          { visibility: 'public' },
          { visibility: 'friends' }
        ]
      }
    });

    // Transform posts to include like/share status for current user
    const transformedPosts = await Promise.all(
      posts.map(async (post) => {
        const isLiked = await prisma.post.findFirst({
          where: {
            id: post.id,
            likes: {
              some: { id: userId }
            }
          }
        });

        const isShared = await prisma.post.findFirst({
          where: {
            id: post.id,
            shares: {
              some: { id: userId }
            }
          }
        });

        return {
          id: post.id,
          content: post.content,
          visibility: post.visibility,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          user: post.user,
          media: post.media,
          stats: {
            likesCount: post._count.likes,
            commentsCount: post._count.comments,
            sharesCount: post._count.shares
          },
          isLiked: !!isLiked,
          isShared: !!isShared
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        posts: transformedPosts,
        pagination: {
          page,
          limit,
          total: totalPosts,
          pages: Math.ceil(totalPosts / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get following posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get following posts'
    });
  }
});

/**
 * @route   GET /api/posts/:id
 * @desc    Get single post
 * @access  Public (with optional auth for like status)
 */
router.get('/get/:id', validatePostId, optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        media: true,
        _count: {
          select: {
            likes: true,
            shares: true
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check if current user liked the post
    let isLiked = false;
    if (currentUserId) {
      const like = await prisma.post.findFirst({
        where: {
          id: post.id,
          likes: {
            some: { id: currentUserId }
          }
        }
      });
      isLiked = !!like;
    }

    res.status(200).json({
      status: 'success',
      data: {
        post: {
          ...post,
          likesCount: post._count.likes,
          sharesCount: post._count.shares,
          isLiked
        }
      }
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get post'
    });
  }
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Update post
 * @access  Private (only post owner)
 */
router.put('/:id', authenticateToken, validatePostId, validatePost, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, visibility } = req.body;
    const userId = req.user.id;

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingPost) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found or you do not have permission to update it'
      });
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content,
        visibility
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
        media: true,
        _count: {
          select: {
            likes: true,
            shares: true
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Post updated successfully',
      data: {
        post: {
          ...updatedPost,
          likesCount: updatedPost._count.likes,
          sharesCount: updatedPost._count.shares
        }
      }
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update post'
    });
  }
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete post
 * @access  Private (only post owner)
 */
router.delete('/:id', authenticateToken, validatePostId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists and user owns it
    const existingPost = await prisma.post.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingPost) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found or you do not have permission to delete it'
      });
    }

    // Delete post (cascade will handle media deletion)
    await prisma.post.delete({
      where: { id }
    });

    res.status(200).json({
      status: 'success',
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete post'
    });
  }
});

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like/unlike post
 * @access  Private
 */
router.post('/:id/like', authenticateToken, validatePostId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check if user already liked the post
    const existingLike = await prisma.post.findFirst({
      where: {
        id,
        likes: {
          some: { id: userId }
        }
      }
    });

    if (existingLike) {
      // Unlike the post
      await prisma.post.update({
        where: { id },
        data: {
          likes: {
            disconnect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Post unliked',
        action: 'unliked'
      });
    } else {
      // Like the post
      await prisma.post.update({
        where: { id },
        data: {
          likes: {
            connect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Post liked',
        action: 'liked'
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to like/unlike post'
    });
  }
});

/**
 * @route   POST /api/posts/:id/share
 * @desc    Share post
 * @access  Private
 */
router.post('/:id/share', authenticateToken, validatePostId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check if user already shared the post
    const existingShare = await prisma.post.findFirst({
      where: {
        id,
        shares: {
          some: { id: userId }
        }
      }
    });

    if (existingShare) {
      return res.status(400).json({
        status: 'error',
        message: 'Post already shared'
      });
    }

    // Share the post
    await prisma.post.update({
      where: { id },
      data: {
        shares: {
          connect: { id: userId }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Post shared successfully'
    });

  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to share post'
    });
  }
});

/**
 * @route   GET /api/posts/search
 * @desc    Search posts by content
 * @access  Public (with optional auth for like status)
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    // Build where clause for content search
    const whereClause = {
      content: {
        contains: q.trim()
      },
      visibility: 'public'
    };

    // If user is authenticated, include their posts and friends' posts
    if (currentUserId) {
      const userFollowing = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { following: { select: { id: true } } }
      });

      const followingIds = userFollowing?.following.map(user => user.id) || [];

      whereClause.OR = [
        { visibility: 'public' },
        { userId: currentUserId },
        {
          AND: [
            { visibility: 'friends' },
            { userId: { in: followingIds } }
          ]
        }
      ];
      delete whereClause.visibility;
    }

    // Get posts with pagination
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            profilePicture: true,
            isVerified: true
          }
        },
        media: true,
        _count: {
          select: {
            likes: true,
            shares: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Check if current user liked each post
    const postsWithLikes = await Promise.all(
      posts.map(async (post) => {
        let isLiked = false;
        if (currentUserId) {
          const like = await prisma.post.findFirst({
            where: {
              id: post.id,
              likes: {
                some: { id: currentUserId }
              }
            }
          });
          isLiked = !!like;
        }

        return {
          ...post,
          likesCount: post._count.likes,
          sharesCount: post._count.shares,
          isLiked
        };
      })
    );

    // Get total count
    const totalPosts = await prisma.post.count({
      where: whereClause
    });

    res.status(200).json({
      status: 'success',
      data: {
        posts: postsWithLikes,
        pagination: {
          page,
          limit,
          total: totalPosts,
          pages: Math.ceil(totalPosts / limit)
        }
      }
    });

  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search posts'
    });
  }
});


module.exports = router;
