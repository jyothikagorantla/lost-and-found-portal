# 🔍 Lost & Found Portal

A complete, full-stack, responsive, and secure web application designed to help colleges, universities, hostels, offices, and communities report lost belongings, report found items, match potential items, submit ownership claims with evidence, and safely recover personal property.

---

## 📋 Table of Contents
1. [Overview & Problem Statement](#-overview--problem-statement)
2. [Key Features](#-key-features)
3. [Technology Stack](#-technology-stack)
4. [Prerequisites](#-prerequisites)
5. [Windows Quick Start Guide (PowerShell)](#-windows-quick-start-guide-powershell)
6. [MongoDB Setup Instructions](#-mongodb-setup-instructions)
7. [Environment Variable Configuration](#-environment-variable-configuration)
8. [Administrator Account Setup](#-administrator-account-setup)
9. [Sample Data Seeding](#-sample-data-seeding)
10. [Feature Usage Walkthrough](#-feature-usage-walkthrough)
11. [Item Matching Algorithm](#-item-matching-algorithm)
12. [Project Folder Structure](#-project-folder-structure)
13. [Running Automated Tests](#-running-automated-tests)
14. [Security Architecture](#-security-architecture)
15. [Troubleshooting & FAQ](#-troubleshooting--faq)
16. [Screenshots](#-screenshots)

---

## 🌟 Overview & Problem Statement

### The Problem
On college campuses, in workplaces, libraries, and public facilities, hundreds of items are misplaced daily—such as laptops, student IDs, keys, wallets, water bottles, and textbooks. Existing manual methods (paper logs, WhatsApp groups, social media posts) are fragmented, unsearchable, insecure, and lack fraud-prevention mechanisms for verifying ownership.

### The Solution
The **Lost & Found Portal** provides a centralized, database-backed platform where:
- **Regular Users** can lodge reports for items they have lost.
- **Finders** (using the same user system) can report items they have discovered without publishing sensitive identifying secrets.
- **Owners** can search, filter, and file verifiable ownership claims.
- **Administrators** can moderate content, review disputed claims, oversee user activity, and maintain community trust.

---

## ✨ Key Features

### 1. User Roles & Account System
- **Regular User / Finder**: Sign up, log in, manage personal reports, submit ownership claims, receive in-app alerts.
- **Administrator**: Access the dedicated Admin Control Center to moderate items, inspect claim history, and suspend or reactivate user accounts.
- **Secure Authentication**: Password hashing using `bcryptjs` (salt rounds: 10), express-session session management, and rate limiting to prevent brute-force attacks.

### 2. Comprehensive Item Reporting
- **Report Lost Belongings**: Item title, category, location last seen, date, description, photo upload (via Multer), and **confidential private notes** (e.g. serial numbers, wallpapers) hidden from the public.
- **Report Found Items**: Item title, category, discovery location, date found, description, and photo upload.
- **Predefined Categories**:
  - Electronics
  - Wallets and Purses
  - Identity Cards
  - Keys
  - Bags and Luggage
  - Books and Stationery
  - Clothing
  - Jewellery and Accessories
  - Documents
  - Other

### 3. Live Database Search, Filters & Pagination
- Full keyword search querying titles, locations, and descriptions.
- Filter by report type (`Lost` / `Found`), category, location, date range, and status (`Active`, `Claimed`, `Resolved`).
- Sorting by newest, oldest, and alphabetical title.
- Clean server-side pagination that preserves active filter parameters.

### 4. Verified Ownership Claim Workflow
- Users cannot claim their own reports.
- Duplicate pending claims by the same claimant on the same item are blocked.
- Claim form includes: detailed explanation of ownership, proof points, and optional evidence image upload (e.g. receipts, barcodes).
- Finders and Administrators review the evidence, record feedback, and mark claims as **Approved** or **Rejected**.
- Approving a claim transitions the item to `claimed`; once physically returned, the item is marked as `resolved`.

### 5. Automated Smart Matching Engine
- Compares opposite item types (`lost` ↔ `found`) in the same category.
- Evaluates keyword overlap in titles and descriptions, location similarity, and date proximity.
- Suggests candidate matches with a calculated match percentage and explanation badges.
- Automatically dispatches in-app notifications to users when a strong match is detected.

### 6. In-App Notification System
- Real-time notification bell badge in the navigation bar with unread counts.
- Alerts for events:
  - New claim submitted on your report.
  - Claim approved or rejected.
  - Item marked as resolved.
  - Potential matching item discovered.
- Mark individual notifications as read or mark all as read.

### 7. Administrator Control Center
- Real-time statistics: Total users, lost reports, found reports, active searches, resolved items, pending claims.
- **User Management**: Search users, filter by role/status, inspect report and claim counts, toggle account status (Active / Suspended).
- **Item Moderation**: View all reports platform-wide, change statuses, delete fraudulent or inappropriate listings.
- **Claim Oversight**: Review all ownership claims and audit verification decisions.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript, EJS (Embedded JavaScript Templates), Bootstrap 5.3, Bootstrap Icons |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Authentication & Security** | `express-session`, `connect-mongo`, `bcryptjs`, `express-validator`, `helmet`, `express-rate-limit`, custom session-based CSRF protection |
| **File Uploads** | `multer` (5MB limit, MIME type whitelist for JPEG, PNG, WebP, GIF) |
| **Configuration** | `dotenv` |
| **Testing** | Node.js built-in test runner (`node --test`), `supertest`, `mongodb-memory-server` |

---

## 📦 Prerequisites

Before running the portal, ensure you have:
1. **Node.js** (v18.0.0 or later): [Download Node.js](https://nodejs.org/)
2. **MongoDB** (Local Community Server v6.0+ or MongoDB Atlas Cloud URI): [Download MongoDB](https://www.mongodb.com/try/download/community)
   > *Note: For zero-setup local evaluation, an automated in-memory MongoDB fallback is included automatically if a local MongoDB service is not started.*

---

## 💻 Windows Quick Start Guide (PowerShell)

Follow these exact commands in **Windows PowerShell**:

### 1. Open PowerShell and Navigate to the Project
```powershell
cd "c:\Users\JYOTHIKA\OneDrive\Desktop\FSD2"
```

### 2. Install Project Dependencies
```powershell
npm install
```

### 3. Configure the Environment
Ensure your `.env` file exists:
```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

### 4. Seed the Database with Realistic Demo Data
```powershell
npm run seed
```
This populates the database with 3 sample users, 6 lost & found reports across categories, a sample claim, and notifications.

### 5. Create / Verify the Administrator Account
```powershell
npm run create-admin
```

### 6. Start the Web Application
```powershell
npm start
```
*For active development with auto-reloading:*
```powershell
npm run dev
```

### 7. Open the Application in Your Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🍃 MongoDB Setup Instructions

### Option A: Local MongoDB Community Service (Recommended for Production)
1. Install MongoDB Community Edition for Windows.
2. Verify or start the MongoDB Windows service in PowerShell:
   ```powershell
   net start MongoDB
   ```
3. The default connection URI in `.env` is:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/lost_found_portal
   ```

### Option B: MongoDB Atlas (Cloud Database)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist your IP (or allow `0.0.0.0/0`).
3. Copy your connection string into your `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/lost_found_portal?retryWrites=true&w=majority
   ```

### Option C: Zero-Config In-Memory Fallback
If local MongoDB is not running, the application automatically boots a local in-memory MongoDB instance for seamless testing. You can also explicitly enforce in-memory mode by adding:
```env
USE_MEMORY_DB=true
```

---

## ⚙️ Environment Variable Configuration

Create a `.env` file in the root directory:

```env
# Application Port
PORT=3000

# MongoDB Connection String
MONGODB_URI=mongodb://127.0.0.1:27017/lost_found_portal

# Session Secret (random 32+ character string)
SESSION_SECRET=lost_and_found_portal_super_secret_session_key_2026_xyz

# Default Administrator Credentials
ADMIN_NAME=Portal Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123456

# Environment Mode
NODE_ENV=development
```

---

## 👤 Administrator Account Setup

To bootstrap or promote an administrator without exposing credentials:

```powershell
npm run create-admin
```

### Default Demo Logins (After running `npm run seed`):
| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@example.com` | `Admin@123456` | Full admin control, item moderation, user suspension, all claims |
| **Regular User 1** | `sarah@example.com` | `User@123456` | Report lost/found, manage reports, review received claims |
| **Regular User 2** | `alex@example.com` | `User@123456` | Report lost/found, file claims on discovered items |

---

## 📖 Feature Usage Walkthrough

### Reporting a Lost Belonging
1. Log in to your account.
2. Click **"Report Lost"** in the top navigation bar.
3. Provide the item name (e.g. *"Space Grey MacBook Air"*), category, last-seen location, and date.
4. Add a public description and upload a photograph.
5. In **"Private Identifying Notes"**, enter details known only to you (e.g. *"Serial ends in 789"*). This field remains confidential.
6. Click **Submit Report**. You will be redirected to the report page, and the matching engine will check for candidate found items.

### Reporting a Found Item
1. Click **"Report Found"** in the navigation bar.
2. Enter the item details, category, location found, and discovery date.
3. Submit the report. It is now published in the public directory for owners to find.

### Submitting an Ownership Claim
1. Browse to any found item that belongs to you.
2. Click **"Submit Ownership Claim"**.
3. Detail your proof in the explanation field (e.g. unique scratches, contents of wallet, serial numbers).
4. Optionally attach a supporting document or photo (receipt, warranty card).
5. Click **Submit Claim**. The reporter is immediately notified.

### Reviewing Claims & Resolving Recoveries
1. The reporter receives an in-app notification and opens the claim review screen.
2. The reporter reviews the explanation against their private knowledge of the item.
3. Click **"Approve Claim"** (item moves to `claimed`) or **"Reject Claim"**.
4. Once the item is handed over in person, click **"Mark as Recovered & Resolved"** to archive the case successfully.

---

## 🧠 Item Matching Algorithm

The `matchingService.js` performs heuristic multi-factor scoring (0 to 100%):
1. **Category Match (35%)**: Exact match between lost and found categories.
2. **Title Keyword Similarity (30%)**: Tokenizes words, filters out stop words, and measures keyword overlap.
3. **Description Overlap (15%)**: Identifies shared identifying adjectives, brands, and colors.
4. **Location Proximity (10%)**: Flags common location keywords (e.g. *"Library"*, *"Gym"*).
5. **Date Proximity (10%)**: Scores items reported lost and found within a 3 to 14 day window.

Candidate items with a score $\ge 35\%$ are presented on the item details page as suggestions and trigger automated notifications.

---

## 📁 Project Folder Structure

```
lost-and-found-portal/
├── config/
│   └── db.js                 # MongoDB connection & in-memory fallback
├── controllers/
│   ├── adminController.js    # Admin statistics, user & item moderation
│   ├── authController.js     # Register, login, logout, user dashboard
│   ├── claimController.js    # Claim submission, review, approval/rejection
│   ├── itemController.js     # Report lost/found, browse, search, filters
│   └── notificationController.js # In-app notification management
├── middleware/
│   ├── admin.js              # Admin role-based authorization check
│   ├── auth.js               # Authentication check & user locals injector
│   ├── csrf.js               # Session-based CSRF protection
│   ├── errorHandler.js       # 404 and 500 error handlers
│   ├── upload.js             # Multer photo upload configuration
│   └── validation.js         # express-validator rules for all forms
├── models/
│   ├── Claim.js              # Ownership Claim schema & validation
│   ├── Item.js               # Lost/Found Item schema & text search indexes
│   ├── Notification.js       # In-app Notification schema
│   └── User.js               # User schema, bcrypt hash & status
├── public/
│   ├── css/
│   │   └── style.css         # Custom responsive stylesheet (Navy/Teal)
│   ├── images/
│   │   ├── default-item.svg  # Fallback image placeholder
│   │   └── logo.svg          # Vector portal brand logo
│   ├── js/
│   │   └── main.js           # Client validation, auto-alerts & preview
│   └── uploads/              # Uploaded photos (.gitkeep preserved)
├── routes/
│   ├── adminRoutes.js        # /admin route handlers
│   ├── authRoutes.js         # /auth and /dashboard route handlers
│   ├── claimRoutes.js        # /claims route handlers
│   ├── itemRoutes.js         # /items route handlers
│   └── notificationRoutes.js # /notifications route handlers
├── scripts/
│   ├── createAdmin.js        # Administrator setup script
│   └── seedData.js           # Demo database seeder script
├── services/
│   ├── matchingService.js    # Smart item matching algorithm
│   └── notificationService.js# In-app notification creation & queries
├── tests/
│   └── app.test.js           # Automated end-to-end test suite (22 tests)
├── views/
│   ├── admin/                # Admin views (dashboard, users, items, claims)
│   ├── auth/                 # Login & Registration views
│   ├── claims/               # Claim form, list, and review views
│   ├── items/                # Browse, report, edit, details, my-reports views
│   ├── partials/             # Header, navbar, footer, alerts, pagination
│   ├── 404.ejs               # Custom 404 Not Found page
│   ├── 500.ejs               # Custom 500 Server Error page
│   ├── about.ejs             # About & FAQ page
│   ├── contact.ejs           # Contact & Help Desk page
│   ├── dashboard.ejs         # User Dashboard
│   ├── index.ejs             # Homepage landing with DB stats & search
│   ├── notifications.ejs     # Notification center view
│   ├── privacy.ejs           # Privacy policy
│   └── terms.ejs             # Terms of service
├── .env.example              # Template environment variables
├── .gitignore                # Git exclusions
├── app.js                    # Express application entry point
├── package.json              # Dependencies and NPM scripts
└── README.md                 # Complete project documentation
```

---

## 🧪 Running Automated Tests

The application includes an automated test suite verifying all critical workflows:
- Static pages and 404 handling.
- Registration, validation, password hashing, and duplicate email prevention.
- Session persistence and route protection.
- Item reporting, image uploads, public/private note privacy checks.
- Real database search and multi-parameter filtering.
- Ownership claim submission, duplicate prevention, and finder approval.
- In-app notification delivery.
- Administrator role restrictions, user management, and moderation.

### Run Tests in PowerShell:
```powershell
npm test
```

### Expected Output:
```
▶ 1. Static Pages Load Successfully
  ✔ GET / returns 200 with home hero and portal name
  ✔ GET /about returns 200
  ✔ GET /contact returns 200
  ✔ GET /unknown-route returns 404
✔ 1. Static Pages Load Successfully
▶ 2. Authentication & Authorization Workflow
  ✔ GET /auth/register loads form and sets CSRF token
  ✔ POST /auth/register fails with mismatched passwords
  ✔ POST /auth/register successfully registers and redirects to dashboard
  ✔ POST /auth/register rejects duplicate email from new guest
  ✔ GET /dashboard allows authenticated user
  ✔ Unauthenticated access to /dashboard redirects to /auth/login
  ✔ Regular user is redirected with access denied from /admin routes
✔ 2. Authentication & Authorization Workflow
▶ 3. Item Reporting & Search Features
  ✔ POST /items creates a lost item report
  ✔ GET /items/:id renders item details and conceals private notes from public
  ✔ GET /items search and filters work correctly
✔ 3. Item Reporting & Search Features
✔ 4. Ownership Claims & Resolution Workflow
▶ 5. Administrator Access and Moderation
  ✔ Admin can access /admin dashboard
  ✔ Admin can view all users list
  ✔ Admin can view all items list
✔ 5. Administrator Access and Moderation
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
```

---

## 🔒 Security Architecture

1. **Password Security**: Passwords are never stored in plain text. Hashed with `bcryptjs` using 10 salt rounds.
2. **CSRF Protection**: Stateful session CSRF tokens are injected into all views and validated on every mutating request (`POST`, `PUT`, `DELETE`).
3. **Session Hardening**: Sessions are backed by MongoDB with HTTP-only cookies, lax SameSite attributes, and configurable secure cookie flags in production.
4. **Input Validation & Sanitization**: Strict `express-validator` schemas validate all inputs on the server before database persistence.
5. **Upload Protection**: File uploads via Multer are restricted to image MIME types (`jpeg`, `png`, `webp`, `gif`), capped at 5MB, and stored with randomized unique filenames.
6. **Rate Limiting**: `express-rate-limit` prevents brute-force attempts on `/auth/login` and `/auth/register`.
7. **Security Headers**: `helmet` configures Content-Security-Policy (CSP), clickjacking protection (X-Frame-Options), and MIME-sniffing prevention.
8. **Role-Based Access Control**: Server-side middleware verifies roles before granting access to moderation and administrative routes.

---

## ❓ Troubleshooting & FAQ

### 1. `mongod : The term 'mongod' is not recognized`
- **Cause**: MongoDB is not installed or not added to your Windows PATH.
- **Solution**: The application includes an automated fallback to `mongodb-memory-server` in development mode, so you can run the app immediately even without local MongoDB. To install local MongoDB permanently, download it from [MongoDB.com](https://www.mongodb.com/try/download/community).

### 2. `Port 3000 is already in use`
- Change `PORT=3001` in your `.env` file, or stop the conflicting process in PowerShell:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```

### 3. Uploaded images do not show
- Ensure the `public/uploads/` directory exists. The application automatically creates it on startup.

---

## 📸 Screenshots

To add screenshots to your documentation:
1. Capture screenshots of:
   - Homepage with hero section, statistics, and category shortcuts.
   - Browse & Search Items page with active filters.
   - Item details page showing matching suggestions and confidential notes box.
   - Ownership Claim submission and review interface.
   - User Dashboard and Notifications page.
   - Administrator Control Center.
2. Save image files in a `docs/screenshots/` folder.
3. Link them using Markdown:
   ```markdown
   ![Homepage](docs/screenshots/homepage.png)
   ![Browse Page](docs/screenshots/browse.png)
   ![Admin Dashboard](docs/screenshots/admin.png)
   ```

---

## 📄 License
This project is licensed under the MIT License.
