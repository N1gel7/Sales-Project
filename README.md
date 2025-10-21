# Sales Management System

A full-stack sales management application with React frontend and Node.js/Express backend, featuring user authentication, task management, invoice generation, and interactive mapping.

## 🚀 Features

- **User Authentication**: JWT-based login/signup with role-based access (Admin, Manager, Sales)
- **Dashboard**: Analytics and overview of sales activities
- **Task Management**: Create, assign, and track sales tasks
- **Invoice System**: Generate and manage invoices with PDF export
- **Interactive Maps**: Live location tracking and task mapping
- **Product Management**: CRUD operations for products and categories
- **Media Upload**: File upload with transcription capabilities
- **Real-time Chat**: Team communication system
- **Reports**: Comprehensive sales reporting and analytics

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Leaflet** for interactive maps
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **SendGrid** for email services
- **AWS S3 SDK** for Cloudflare R2 storage
- **OpenAI** for transcription services

## 📁 Project Structure

```
Sales Project/
├── api/                    # Backend API routes
│   ├── index.js           # Main serverless function entry point
│   ├── auth.js            # Authentication routes
│   ├── invoices.js        # Invoice management
│   ├── tasks.js           # Task management
│   ├── products.js        # Product management
│   └── ...                # Other API endpoints
├── models/                # MongoDB schemas
│   ├── User.js           # User model
│   ├── Task.js           # Task model
│   ├── Invoice.js        # Invoice model
│   └── ...               # Other models
├── sales-mgmt/           # React frontend
│   ├── src/
│   │   ├── pages/        # React components
│   │   ├── services/     # API services
│   │   └── store/        # State management
│   ├── package.json
│   └── vite.config.ts
├── public/               # Static assets
├── views/               # EJS templates (legacy)
├── server.js            # Local development server
├── package.json         # Root dependencies
└── vercel.json         # Vercel deployment config
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (local or MongoDB Atlas)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/sales-project.git
   cd sales-project
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd sales-mgmt
   npm install
   cd ..
   ```

4. **Environment Setup**
   Create a `.env` file in the root directory:
   
   ⚠️ **Security Note**: Never commit real credentials to version control. Use placeholder values in documentation.
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/sales-mgmt
   # or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database

   # JWT Secret
   # No JWT_SECRET needed - using database sessions

   # Email Service (SendGrid)
   SENDGRID_API_KEY=your-sendgrid-api-key

   # Cloudflare R2 Storage
   R2_ENDPOINT=your-r2-endpoint
   R2_ACCESS_KEY_ID=your-r2-access-key
   R2_SECRET_ACCESS_KEY=your-r2-secret-key

   # OpenAI API
   OPENAI_API_KEY=your-openai-api-key

   # Server
   PORT=3000
   NODE_ENV=development
   ```

### Development

1. **Start the backend server**
   ```bash
   npm run dev
   # or
   node server.js
   ```

2. **Start the frontend development server**
   ```bash
   cd sales-mgmt
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api

### Available Scripts

#### Root Level
```bash
npm run dev          # Start backend development server
npm run vercel-build # Build for Vercel deployment
```

#### Frontend (sales-mgmt/)
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🔧 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/signup` - User registration
- `GET /api/profile` - Get user profile (protected)

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Invoices
- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/:id/pdf` - Download invoice PDF

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Health Check
- `GET /api/health` - API health status
- `GET /api/test-db` - Database connection test

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   - Push your code to GitHub
   - Connect your repository to Vercel
   - Set environment variables in Vercel dashboard

2. **Environment Variables in Vercel**
   ```
   MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/your-database
   # No JWT_SECRET needed - using database sessions
   SENDGRID_API_KEY=your-sendgrid-key
   R2_ENDPOINT=your-r2-endpoint
   R2_ACCESS_KEY_ID=your-r2-access-key
   R2_SECRET_ACCESS_KEY=your-r2-secret-key
   OPENAI_API_KEY=your-openai-key
   ```

3. **Deploy**
   - Vercel will automatically deploy on every push to main branch
   - Or manually trigger deployment from Vercel dashboard

### Manual Deployment

1. **Build the frontend**
   ```bash
   cd sales-mgmt
   npm run build
   cd ..
   ```

2. **Deploy backend**
   - Deploy to your preferred hosting service
   - Ensure MongoDB is accessible
   - Set all environment variables

## 🗄️ Database Setup

### MongoDB Atlas (Recommended)

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string
6. Update `MONGODB_URI` in your environment variables

### Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service
3. Create a database named `sales-mgmt`
4. Use `mongodb://localhost:27017/sales-mgmt` as your `MONGODB_URI`

## 🔐 Default Users

After setting up the database, you can create users through the signup endpoint or directly in MongoDB:

```javascript
// Example user creation
{
  "name": "Admin User",
  "email": "admin@example.com",
  "passwordHash": "hashed-password",
  "role": "admin",
  "code": "ADM001"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Timeout**
   - Check your `MONGODB_URI`
   - Ensure MongoDB Atlas network access allows your IP
   - Verify database user permissions

2. **JWT Token Issues**
   - Ensure `MONGODB_URI` is set
   - Check token expiration (default: 24 hours)

3. **CORS Errors**
   - Check if frontend URL is whitelisted
   - Verify API endpoint URLs

4. **Build Errors**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify all environment variables are set

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=*
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/sales-project/issues) page
2. Create a new issue with detailed description
3. Include error logs and steps to reproduce

## 🔄 Version History

- **v1.0.0** - Initial release with basic CRUD operations
- **v1.1.0** - Added interactive mapping and real-time features
- **v1.2.0** - Implemented invoice generation and PDF export
- **v1.3.0** - Added media upload and transcription features

---

**Happy Coding! 🚀**
