const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
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
const validateComment = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment content must be between 1 and 1000 characters'),
  
  handleValidationErrors
];

const validateCommentId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Comment ID is required'),
  
  handleValidationErrors
];

const validatePostId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Post ID is required'),
  
  handleValidationErrors
];

/**
 * @route   POST /api/posts/:id/comments
 * @desc    Add comment to a post
 * @access  Private
 */
router.post('/posts/:id/comments', authenticateToken, validatePostId, validateComment, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { content, parentComment } = req.body;
    const userId = req.user.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // If parentComment is provided, check if it exists and belongs to the same post
    if (parentComment) {
      const parentCommentExists = await prisma.comment.findFirst({
        where: {
          id: parentComment,
          postId: postId
        }
      });

      if (!parentCommentExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Parent comment not found or does not belong to this post'
        });
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content,
        parentComment: parentComment || null
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
        parent: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                fullname: true
              }
            }
          }
        },
        _count: {
          select: {
            likes: true,
            replies: true
          }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully',
      data: {
        comment: {
          ...comment,
          likesCount: comment._count.likes,
          repliesCount: comment._count.replies
        }
      }
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add comment'
    });
  }
});

/**
 * @route   GET /api/posts/:id/comments
 * @desc    Get post comments with nested replies
 * @access  Public (with optional auth for like status)
 */
router.get('/posts/:id/comments', validatePostId, optionalAuth, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Get top-level comments (no parent) with pagination
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentComment: null // Only top-level comments
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
        replies: {
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
                replies: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        _count: {
          select: {
            likes: true,
            replies: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Check if current user liked each comment and reply
    const commentsWithLikes = await Promise.all(
      comments.map(async (comment) => {
        let isLiked = false;
        if (currentUserId) {
          const like = await prisma.comment.findFirst({
            where: {
              id: comment.id,
              likes: {
                some: { id: currentUserId }
              }
            }
          });
          isLiked = !!like;
        }

        // Process replies
        const repliesWithLikes = await Promise.all(
          comment.replies.map(async (reply) => {
            let replyIsLiked = false;
            if (currentUserId) {
              const replyLike = await prisma.comment.findFirst({
                where: {
                  id: reply.id,
                  likes: {
                    some: { id: currentUserId }
                  }
                }
              });
              replyIsLiked = !!replyLike;
            }

            return {
              ...reply,
              likesCount: reply._count.likes,
              repliesCount: reply._count.replies,
              isLiked: replyIsLiked
            };
          })
        );

        return {
          ...comment,
          likesCount: comment._count.likes,
          repliesCount: comment._count.replies,
          isLiked,
          replies: repliesWithLikes
        };
      })
    );

    // Get total count of top-level comments
    const totalComments = await prisma.comment.count({
      where: {
        postId,
        parentComment: null
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        comments: commentsWithLikes,
        pagination: {
          page,
          limit,
          total: totalComments,
          pages: Math.ceil(totalComments / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get comments'
    });
  }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Update comment
 * @access  Private (only comment owner)
 */
router.put('/comments/:id', authenticateToken, validateCommentId, validateComment, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingComment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found or you do not have permission to update it'
      });
    }

    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { content },
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
            replies: true
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Comment updated successfully',
      data: {
        comment: {
          ...updatedComment,
          likesCount: updatedComment._count.likes,
          repliesCount: updatedComment._count.replies
        }
      }
    });

  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update comment'
    });
  }
});

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete comment
 * @access  Private (only comment owner)
 */
router.delete('/comments/:id', authenticateToken, validateCommentId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingComment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found or you do not have permission to delete it'
      });
    }

    // Delete comment (cascade will handle replies deletion)
    await prisma.comment.delete({
      where: { id }
    });

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete comment'
    });
  }
});

/**
 * @route   POST /api/comments/:id/like
 * @desc    Like/unlike comment
 * @access  Private
 */
router.post('/comments/:id/like', authenticateToken, validateCommentId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id }
    });

    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check if user already liked the comment
    const existingLike = await prisma.comment.findFirst({
      where: {
        id,
        likes: {
          some: { id: userId }
        }
      }
    });

    if (existingLike) {
      // Unlike the comment
      await prisma.comment.update({
        where: { id },
        data: {
          likes: {
            disconnect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Comment unliked',
        action: 'unliked'
      });
    } else {
      // Like the comment
      await prisma.comment.update({
        where: { id },
        data: {
          likes: {
            connect: { id: userId }
          }
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Comment liked',
        action: 'liked'
      });
    }

  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to like/unlike comment'
    });
  }
});

/**
 * @route   GET /api/comments/:id/replies
 * @desc    Get comment replies
 * @access  Public (with optional auth for like status)
 */
router.get('/comments/:id/replies', validateCommentId, optionalAuth, async (req, res) => {
  try {
    const { id: parentCommentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id;

    // Check if parent comment exists
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentCommentId }
    });

    if (!parentComment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Get replies with pagination
    const replies = await prisma.comment.findMany({
      where: {
        parentComment: parentCommentId
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
            replies: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      skip,
      take: limit
    });

    // Check if current user liked each reply
    const repliesWithLikes = await Promise.all(
      replies.map(async (reply) => {
        let isLiked = false;
        if (currentUserId) {
          const like = await prisma.comment.findFirst({
            where: {
              id: reply.id,
              likes: {
                some: { id: currentUserId }
              }
            }
          });
          isLiked = !!like;
        }

        return {
          ...reply,
          likesCount: reply._count.likes,
          repliesCount: reply._count.replies,
          isLiked
        };
      })
    );

    // Get total count
    const totalReplies = await prisma.comment.count({
      where: {
        parentComment: parentCommentId
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        replies: repliesWithLikes,
        pagination: {
          page,
          limit,
          total: totalReplies,
          pages: Math.ceil(totalReplies / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get replies'
    });
  }
});

module.exports = router;
