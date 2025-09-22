# Follower API

A complete Express.js API for user management with MySQL database and JWT authentication. This API provides user registration, authentication, profile management, and follow/unfollow functionality.

## Features

- 🔐 JWT Authentication
- 👤 User Registration & Login
- 📝 Profile Management
- 👥 Follow/Unfollow System
- 📱 Posts Management with Image Upload
- 🖼️ Image Processing with Sharp
- ❤️ Like/Unlike Posts
- 🔄 Share Posts
- 💬 Comments System with Nested Replies
- 👍 Like/Unlike Comments
- 🗄️ MySQL Database with Prisma ORM
- 🛡️ Security Middleware (Helmet, Rate Limiting)
- ✅ Input Validation
- 📊 Pagination Support

## Tech Stack

- **Backend**: Express.js
- **Database**: MySQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **Image Processing**: Sharp
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user profile

### User Management
- `GET /api/users/profile/:id` - Get user profile by ID
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/follow/:id` - Follow a user
- `DELETE /api/users/unfollow/:id` - Unfollow a user
- `GET /api/users/followers/:id` - Get user's followers
- `GET /api/users/following/:id` - Get users that the user is following

### Posts Management
- `POST /api/posts` - Create new post (with image upload)
- `GET /api/posts` - Get timeline posts
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/share` - Share post

### Comments System
- `POST /api/posts/:id/comments` - Add comment to post
- `GET /api/posts/:id/comments` - Get post comments with nested replies
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment
- `POST /api/comments/:id/like` - Like/unlike comment
- `GET /api/comments/:id/replies` - Get comment replies

### Health Check
- `GET /api/health` - Server health check

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd follower-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `config.env` and update the values:
   ```env
   DATABASE_URL="mysql://username:password@localhost:3306/follower_db"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRES_IN="7d"
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN="http://localhost:3000"
   ```

4. **Set up MySQL database**
   - Create a MySQL database named `follower_db`
   - Update the `DATABASE_URL` in your environment file

5. **Set up Prisma**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Database Schema

### Database Schema

#### User Model
```prisma
model User {
  id             String   @id @default(cuid())
  fullname       String
  email          String   @unique
  password       String
  profilePicture String?
  bio            String?
  isVerified     Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  followers      User[]   @relation("UserFollows")
  following      User[]   @relation("UserFollows")
  posts          Post[]
  likedPosts     Post[]   @relation("PostLikes")
  sharedPosts    Post[]   @relation("PostShares")
}
```

#### Post Model
```prisma
model Post {
  id         String   @id @default(cuid())
  userId     String
  content    String
  visibility String   @default("public")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])
  media      PostMedia[]
  likes      User[]   @relation("PostLikes")
  shares     User[]   @relation("PostShares")
}

model PostMedia {
  id     String @id @default(cuid())
  postId String
  type   String
  url    String
  post   Post   @relation(fields: [postId], references: [id])
}

model Comment {
  id             String    @id @default(cuid())
  postId         String
  userId         String
  content        String
  parentComment  String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  post           Post      @relation(fields: [postId], references: [id])
  user           User      @relation(fields: [userId], references: [id])
  parent         Comment?  @relation("CommentReplies", fields: [parentComment], references: [id])
  replies        Comment[] @relation("CommentReplies")
  likes          User[]    @relation("CommentLikes")
}
```

## API Usage Examples

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "John Doe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Follow a user (requires authentication)
```bash
curl -X POST http://localhost:3000/api/users/follow/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get user profile
```bash
curl -X GET http://localhost:3000/api/users/profile/USER_ID
```

### Create a new post with image
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "content=Check out this amazing sunset! #nature #photography" \
  -F "visibility=public" \
  -F "media=@/path/to/image.jpg"
```

### Get timeline posts
```bash
curl -X GET "http://localhost:3000/api/posts?page=1&limit=10"
```

### Like a post
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Share a post
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/share \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Add a comment to a post
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great post! Thanks for sharing."
  }'
```

### Add a reply to a comment
```bash
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I agree with you!",
    "parentComment": "COMMENT_ID"
  }'
```

### Get post comments
```bash
curl -X GET "http://localhost:3000/api/posts/POST_ID/comments?page=1&limit=10"
```

### Like a comment
```bash
curl -X POST http://localhost:3000/api/comments/COMMENT_ID/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update a comment
```bash
curl -X PUT http://localhost:3000/api/comments/COMMENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated comment content"
  }'
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

The API returns consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [] // Only present for validation errors
}
```

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Rate limiting (100 requests per 15 minutes per IP)
- CORS protection
- Helmet security headers
- Input validation and sanitization

## Development

### Available Scripts

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with nodemon
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run database migrations
- `npm run db:studio` - Open Prisma Studio

### Project Structure

```
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # JWT authentication middleware
│   ├── validation.js        # Input validation middleware
│   └── upload.js            # File upload middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── posts.js             # Posts management routes
│   └── comments.js          # Comments management routes
├── utils/
│   ├── jwt.js               # JWT utility functions
│   ├── password.js          # Password hashing utilities
│   └── content.js           # Content processing utilities
├── public/
│   └── uploads/
│       └── images/          # Uploaded images storage
├── prisma/
│   └── schema.prisma        # Database schema
├── server.js                # Main server file
├── package.json
└── README.md
```

## License

MIT License
#   f o l l o w e r  
 