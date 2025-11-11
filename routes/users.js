const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateProfileUpdate, validateUserId } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/users/profile/:id
 * @desc    Get user profile by ID
 * @access  Public (with optional auth for follow status)
 */
router.get('/profile/:id', validateUserId, optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    // Get user profile with follower/following counts
    const user = await prisma.user.findUnique({
      where: { id },
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

    // Check if current user is following this user (if authenticated)
    let isFollowing = false;
    if (currentUserId && currentUserId !== id) {
      const followRelation = await prisma.user.findFirst({
        where: {
          id: currentUserId,
          following: {
            some: { id: id }
          }
        }
      });
      isFollowing = !!followRelation;
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          followersCount: user._count.followers,
          followingCount: user._count.following,
          isFollowing: currentUserId ? isFollowing : null,
          isOwnProfile: currentUserId === id
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

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const { fullname, bio, profilePicture } = req.body;
    const userId = req.user.id;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullname && { fullname }),
        ...(bio !== undefined && { bio }),
        ...(profilePicture !== undefined && { profilePicture })
      },
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

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
});

/**
 * @route   POST /api/users/follow/:id
 * @desc    Follow a user
 * @access  Private
 */
router.post('/follow/:id', authenticateToken, validateUserId, async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Check if user is trying to follow themselves
    if (currentUserId === targetUserId) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot follow yourself'
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if already following
    const existingFollow = await prisma.user.findFirst({
      where: {
        id: currentUserId,
        following: {
          some: { id: targetUserId }
        }
      }
    });

    if (existingFollow) {
      return res.status(400).json({
        status: 'error',
        message: 'Already following this user'
      });
    }

    // Create follow relationship
    await prisma.user.update({
      where: { id: currentUserId },
      data: {
        following: {
          connect: { id: targetUserId }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: `Now following ${targetUser.fullname}`
    });

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to follow user'
    });
  }
});

/**
 * @route   DELETE /api/users/unfollow/:id
 * @desc    Unfollow a user
 * @access  Private
 */
router.delete('/unfollow/:id', authenticateToken, validateUserId, async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if currently following
    const existingFollow = await prisma.user.findFirst({
      where: {
        id: currentUserId,
        following: {
          some: { id: targetUserId }
        }
      }
    });

    if (!existingFollow) {
      return res.status(400).json({
        status: 'error',
        message: 'Not following this user'
      });
    }

    // Remove follow relationship
    await prisma.user.update({
      where: { id: currentUserId },
      data: {
        following: {
          disconnect: { id: targetUserId }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: `Unfollowed ${targetUser.fullname}`
    });

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unfollow user'
    });
  }
});

/**
 * @route   GET /api/users/followers/:id
 * @desc    Get user's followers
 * @access  Public
 */
router.get('/followers/:id', validateUserId, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get followers with pagination
    const followers = await prisma.user.findMany({
      where: {
        following: {
          some: { id }
        }
      },
      select: {
        id: true,
        fullname: true,
        profilePicture: true,
        isVerified: true
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get total count
    const totalFollowers = await prisma.user.count({
      where: {
        following: {
          some: { id }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        followers,
        pagination: {
          page,
          limit,
          total: totalFollowers,
          pages: Math.ceil(totalFollowers / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get followers'
    });
  }
});

/**
 * @route   GET /api/users/following/:id
 * @desc    Get users that the user is following
 * @access  Public
 */
router.get('/following/:id', validateUserId, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get following users with pagination
    const following = await prisma.user.findMany({
      where: {
        followers: {
          some: { id }
        }
      },
      select: {
        id: true,
        fullname: true,
        profilePicture: true,
        isVerified: true
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get total count
    const totalFollowing = await prisma.user.count({
      where: {
        followers: {
          some: { id }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        following,
        pagination: {
          page,
          limit,
          total: totalFollowing,
          pages: Math.ceil(totalFollowing / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get following users'
    });
  }
});

/**
 * @route   GET /api/users/posts
 * @desc    Get current user's own posts with pagination
 * @access  Private
 */
router.get('/posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get posts with media, likes count, comments count, and shares count
    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        media: true,
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
            comments: true,
            shares: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get total count of user's posts
    const totalPosts = await prisma.post.count({
      where: { userId }
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
    console.error('Get user posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user posts'
    });
  }
});

/**
 * @route   GET /api/users/search
 * @desc    Search users by name and email
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    const { name, email } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if ((!name || name.trim().length === 0) && (!email || email.trim().length === 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one search parameter (name or email) is required'
      });
    }

    // Build where clause for name and email search
    const whereClause = {};

    if (name && name.trim().length > 0) {
      whereClause.fullname = {
        contains: name.trim()
      };
    }

    if (email && email.trim().length > 0) {
      whereClause.email = {
        contains: email.trim()
      };
    }

    // If both name and email are provided, use AND logic
    if (name && email) {
      whereClause.AND = [
        { fullname: { contains: name.trim() } },
        { email: { contains: email.trim() } }
      ];
      delete whereClause.fullname;
      delete whereClause.email;
    }

    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count
    const totalUsers = await prisma.user.count({
      where: whereClause
    });

    // Transform users to include follower/following counts
    const transformedUsers = users.map(user => ({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      followersCount: user._count.followers,
      followingCount: user._count.following
    }));

    res.status(200).json({
      status: 'success',
      data: {
        users: transformedUsers,
        pagination: {
          page,
          limit,
          total: totalUsers,
          pages: Math.ceil(totalUsers / limit)
        }
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search users'
    });
  }
});

module.exports = router;
