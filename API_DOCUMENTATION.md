# Follower API Documentation

A comprehensive REST API for a social media platform built with Express.js, Prisma ORM, and MySQL. This API provides user authentication, profile management, post creation, commenting system, and social features like following/unfollowing users.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication Routes](#authentication-routes)
  - [User Routes](#user-routes)
  - [Post Routes](#post-routes)
  - [Comment Routes](#comment-routes)
  - [Health Check](#health-check)
- [Data Models](#data-models)
- [Response Format](#response-format)
- [File Upload](#file-upload)

## Base URL

```
http://localhost:5000/api
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "errors": [ ... ] // Only present for validation errors
}
```

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit information is included in response headers

## API Endpoints

### Authentication Routes

#### Register User
- **POST** `/auth/register`
- **Access**: Public
- **Description**: Register a new user account

**Request Body:**
```json
{
  "fullname": "John Doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Validation Rules:**
- `fullname`: 2-50 characters, letters and spaces only
- `email`: Valid email format
- `password`: Minimum 6 characters, must contain uppercase, lowercase, and number

**Response:**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com",
      "profilePicture": null,
      "bio": null,
      "isVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### Login User
- **POST** `/auth/login`
- **Access**: Public
- **Description**: Authenticate user and return JWT token

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com",
      "profilePicture": null,
      "bio": null,
      "isVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### Logout User
- **POST** `/auth/logout`
- **Access**: Private
- **Description**: Logout user (client-side token removal)

**Response:**
```json
{
  "status": "success",
  "message": "Logout successful"
}
```

#### Get Current User Profile
- **GET** `/auth/me`
- **Access**: Private
- **Description**: Get current authenticated user's profile with follower counts

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com",
      "profilePicture": null,
      "bio": null,
      "isVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "followersCount": 10,
      "followingCount": 5
    }
  }
}
```

### User Routes

#### Get User Profile
- **GET** `/users/profile/:id`
- **Access**: Public (with optional auth for follow status)
- **Description**: Get user profile by ID with follow status

**Parameters:**
- `id` (string): User ID

**Query Parameters:**
- None

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com",
      "profilePicture": null,
      "bio": null,
      "isVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "followersCount": 10,
      "followingCount": 5,
      "isFollowing": true,
      "isOwnProfile": false
    }
  }
}
```

#### Update User Profile
- **PUT** `/users/profile`
- **Access**: Private
- **Description**: Update current user's profile

**Request Body:**
```json
{
  "fullname": "John Updated",
  "bio": "Updated bio text",
  "profilePicture": "https://example.com/image.jpg"
}
```

**Validation Rules:**
- `fullname`: Optional, 2-50 characters, letters and spaces only
- `bio`: Optional, maximum 500 characters
- `profilePicture`: Optional, valid URL

**Response:**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "user_id",
      "fullname": "John Updated",
      "email": "john@example.com",
      "profilePicture": "https://example.com/image.jpg",
      "bio": "Updated bio text",
      "isVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Follow User
- **POST** `/users/follow/:id`
- **Access**: Private
- **Description**: Follow another user

**Parameters:**
- `id` (string): Target user ID to follow

**Response:**
```json
{
  "status": "success",
  "message": "Now following John Doe"
}
```

#### Unfollow User
- **DELETE** `/users/unfollow/:id`
- **Access**: Private
- **Description**: Unfollow a user

**Parameters:**
- `id` (string): Target user ID to unfollow

**Response:**
```json
{
  "status": "success",
  "message": "Unfollowed John Doe"
}
```

#### Get User Followers
- **GET** `/users/followers/:id`
- **Access**: Public
- **Description**: Get list of user's followers with pagination

**Parameters:**
- `id` (string): User ID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "followers": [
      {
        "id": "follower_id",
        "fullname": "Follower Name",
        "profilePicture": null,
        "isVerified": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

#### Get User Following
- **GET** `/users/following/:id`
- **Access**: Public
- **Description**: Get list of users that the user is following with pagination

**Parameters:**
- `id` (string): User ID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "following": [
      {
        "id": "following_id",
        "fullname": "Following Name",
        "profilePicture": null,
        "isVerified": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### Post Routes

#### Create Post
- **POST** `/posts`
- **Access**: Private
- **Description**: Create a new post with optional media upload

**Request Body (multipart/form-data):**
- `content` (string): Post content (1-2000 characters)
- `visibility` (string, optional): 'public', 'friends', or 'private' (default: 'public')
- `media` (file[], optional): Up to 5 image files (JPEG, JPG, PNG, GIF, WebP)

**Validation Rules:**
- `content`: 1-2000 characters
- `visibility`: Must be 'public', 'friends', or 'private'
- `media`: Maximum 5 files, 10MB each, image formats only

**Response:**
```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "post": {
      "id": "post_id",
      "userId": "user_id",
      "content": "Post content here",
      "visibility": "public",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "fullname": "John Doe",
        "profilePicture": null,
        "isVerified": false
      },
      "media": [
        {
          "id": "media_id",
          "type": "image",
          "url": "/uploads/images/processed_image.jpg"
        }
      ],
      "likesCount": 0,
      "sharesCount": 0
    }
  }
}
```

#### Get Timeline Posts
- **GET** `/posts`
- **Access**: Public (with optional auth for personalized timeline)
- **Description**: Get timeline posts with pagination

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post_id",
        "userId": "user_id",
        "content": "Post content here",
        "visibility": "public",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "id": "user_id",
          "fullname": "John Doe",
          "profilePicture": null,
          "isVerified": false
        },
        "media": [],
        "likesCount": 5,
        "sharesCount": 2,
        "isLiked": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

#### Get Single Post
- **GET** `/posts/:id`
- **Access**: Public (with optional auth for like status)
- **Description**: Get a single post by ID

**Parameters:**
- `id` (string): Post ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "post": {
      "id": "post_id",
      "userId": "user_id",
      "content": "Post content here",
      "visibility": "public",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "fullname": "John Doe",
        "profilePicture": null,
        "isVerified": false
      },
      "media": [],
      "likesCount": 5,
      "sharesCount": 2,
      "isLiked": true
    }
  }
}
```

#### Update Post
- **PUT** `/posts/:id`
- **Access**: Private (only post owner)
- **Description**: Update a post

**Parameters:**
- `id` (string): Post ID

**Request Body:**
```json
{
  "content": "Updated post content",
  "visibility": "friends"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Post updated successfully",
  "data": {
    "post": {
      "id": "post_id",
      "userId": "user_id",
      "content": "Updated post content",
      "visibility": "friends",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "fullname": "John Doe",
        "profilePicture": null,
        "isVerified": false
      },
      "media": [],
      "likesCount": 5,
      "sharesCount": 2
    }
  }
}
```

#### Delete Post
- **DELETE** `/posts/:id`
- **Access**: Private (only post owner)
- **Description**: Delete a post

**Parameters:**
- `id` (string): Post ID

**Response:**
```json
{
  "status": "success",
  "message": "Post deleted successfully"
}
```

#### Like/Unlike Post
- **POST** `/posts/:id/like`
- **Access**: Private
- **Description**: Toggle like status for a post

**Parameters:**
- `id` (string): Post ID

**Response:**
```json
{
  "status": "success",
  "message": "Post liked",
  "action": "liked"
}
```

**Or for unlike:**
```json
{
  "status": "success",
  "message": "Post unliked",
  "action": "unliked"
}
```

#### Share Post
- **POST** `/posts/:id/share`
- **Access**: Private
- **Description**: Share a post

**Parameters:**
- `id` (string): Post ID

**Response:**
```json
{
  "status": "success",
  "message": "Post shared successfully"
}
```

### Comment Routes

#### Add Comment to Post
- **POST** `/posts/:id/comments`
- **Access**: Private
- **Description**: Add a comment to a post

**Parameters:**
- `id` (string): Post ID

**Request Body:**
```json
{
  "content": "This is a comment",
  "parentComment": "parent_comment_id" // Optional for replies
}
```

**Validation Rules:**
- `content`: 1-1000 characters
- `parentComment`: Optional, must be valid comment ID from same post

**Response:**
```json
{
  "status": "success",
  "message": "Comment added successfully",
  "data": {
    "comment": {
      "id": "comment_id",
      "postId": "post_id",
      "userId": "user_id",
      "content": "This is a comment",
      "parentComment": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "fullname": "John Doe",
        "profilePicture": null,
        "isVerified": false
      },
      "parent": null,
      "likesCount": 0,
      "repliesCount": 0
    }
  }
}
```

#### Get Post Comments
- **GET** `/posts/:id/comments`
- **Access**: Public (with optional auth for like status)
- **Description**: Get comments for a post with nested replies

**Parameters:**
- `id` (string): Post ID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "id": "comment_id",
        "postId": "post_id",
        "userId": "user_id",
        "content": "This is a comment",
        "parentComment": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "id": "user_id",
          "fullname": "John Doe",
          "profilePicture": null,
          "isVerified": false
        },
        "parent": null,
        "likesCount": 5,
        "repliesCount": 2,
        "isLiked": true,
        "replies": [
          {
            "id": "reply_id",
            "postId": "post_id",
            "userId": "user_id",
            "content": "This is a reply",
            "parentComment": "comment_id",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z",
            "user": {
              "id": "user_id",
              "fullname": "Jane Doe",
              "profilePicture": null,
              "isVerified": false
            },
            "likesCount": 1,
            "repliesCount": 0,
            "isLiked": false
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

#### Update Comment
- **PUT** `/comments/:id`
- **Access**: Private (only comment owner)
- **Description**: Update a comment

**Parameters:**
- `id` (string): Comment ID

**Request Body:**
```json
{
  "content": "Updated comment content"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Comment updated successfully",
  "data": {
    "comment": {
      "id": "comment_id",
      "postId": "post_id",
      "userId": "user_id",
      "content": "Updated comment content",
      "parentComment": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "fullname": "John Doe",
        "profilePicture": null,
        "isVerified": false
      },
      "likesCount": 5,
      "repliesCount": 2
    }
  }
}
```

#### Delete Comment
- **DELETE** `/comments/:id`
- **Access**: Private (only comment owner)
- **Description**: Delete a comment

**Parameters:**
- `id` (string): Comment ID

**Response:**
```json
{
  "status": "success",
  "message": "Comment deleted successfully"
}
```

#### Like/Unlike Comment
- **POST** `/comments/:id/like`
- **Access**: Private
- **Description**: Toggle like status for a comment

**Parameters:**
- `id` (string): Comment ID

**Response:**
```json
{
  "status": "success",
  "message": "Comment liked",
  "action": "liked"
}
```

**Or for unlike:**
```json
{
  "status": "success",
  "message": "Comment unliked",
  "action": "unliked"
}
```

#### Get Comment Replies
- **GET** `/comments/:id/replies`
- **Access**: Public (with optional auth for like status)
- **Description**: Get replies for a specific comment

**Parameters:**
- `id` (string): Parent comment ID

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "replies": [
      {
        "id": "reply_id",
        "postId": "post_id",
        "userId": "user_id",
        "content": "This is a reply",
        "parentComment": "comment_id",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "id": "user_id",
          "fullname": "Jane Doe",
          "profilePicture": null,
          "isVerified": false
        },
        "likesCount": 1,
        "repliesCount": 0,
        "isLiked": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

### Health Check

#### Server Health Check
- **GET** `/health`
- **Access**: Public
- **Description**: Check if the server is running

**Response:**
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### User
```json
{
  "id": "string (cuid)",
  "fullname": "string",
  "email": "string (unique)",
  "password": "string (hashed)",
  "profilePicture": "string (URL, nullable)",
  "bio": "string (nullable)",
  "isVerified": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Post
```json
{
  "id": "string (cuid)",
  "userId": "string",
  "content": "string",
  "visibility": "string (public|friends|private)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### PostMedia
```json
{
  "id": "string (cuid)",
  "postId": "string",
  "type": "string (image|video)",
  "url": "string"
}
```

### Comment
```json
{
  "id": "string (cuid)",
  "postId": "string",
  "userId": "string",
  "content": "string",
  "parentComment": "string (nullable)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

### Pagination Response
```json
{
  "status": "success",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

## File Upload

### Supported Formats
- **Images**: JPEG, JPG, PNG, GIF, WebP
- **Maximum file size**: 10MB per file
- **Maximum files per request**: 5 files

### Upload Process
1. Files are uploaded via multipart/form-data
2. Images are automatically processed and optimized using Sharp
3. Files are resized to maximum 1200x1200 pixels
4. Processed files are stored in `/public/uploads/images/`
5. Original files are deleted after processing

### File URLs
Uploaded files are accessible via:
```
http://localhost:5000/uploads/images/processed_filename.jpg
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (Validation Error) |
| 401 | Unauthorized (Invalid/Missing Token) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limiting

- **Window**: 15 minutes
- **Limit**: 100 requests per IP
- **Headers**: Rate limit information included in response headers

## CORS Configuration

- **Origin**: Configurable via `CORS_ORIGIN` environment variable
- **Default**: `http://localhost:3000`
- **Credentials**: Supported

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: Prevents abuse
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt
- **Input Validation**: Comprehensive validation rules
- **File Upload Security**: Type and size restrictions

---

For more information or support, please refer to the project repository or contact the development team.
