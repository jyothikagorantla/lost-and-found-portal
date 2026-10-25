## How to Run the Project

### Prerequisites
- Install [Node.js](https://nodejs.org/).
- Set up MongoDB locally or use [MongoDB Atlas](https://www.mongodb.com/atlas).

### Installation Steps

**1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/lost-and-found-portal.git
cd lost-and-found-portal
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the root directory and configure the required environment variables, including `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

**4. Start the application**
```bash
npm start
```

For development mode, run:
```bash
npm run dev
```

**5. Open the application**

Visit http://localhost:3000 in your browser.

**6. Run tests (optional)**
```bash
npm test
```
