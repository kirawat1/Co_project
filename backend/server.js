// Backend/server.js (Final Fix for Load Order)
const express = require('express');
const dotenv = require('dotenv'); // ✅ ต้อง require dotenv ที่นี่

// 1. Load Environment Variables (ต้องอยู่หลัง require)
dotenv.config(); 

const cors = require('cors');

// 2. Import Prisma Client (ตอนนี้ environment พร้อมแล้ว)
const prisma = require('./config/prismaClient'); // Assuming it's in config/

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; 

// 3. Middleware setup
app.use(cors({
    origin: FRONTEND_URL, 
    credentials: true
}));
app.use(express.json()); 

// 4. Routes setup
const authRoutes = require('./routes/authRoutes');
const announcementRoutes = require('./routes/announcementRoutes'); 

app.use('/api/auth', authRoutes); 
app.use('/api/admin/announcements', announcementRoutes); 

// 5. Fallback Route
app.get('/', (req, res) => {
    res.send('API Server is running OK');
});

// 6. Start Server (เชื่อมต่อ DB ด้วย Prisma ก่อน)
async function startServer() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully (via Prisma).');
        
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Could not connect to the database or start server. Check DATABASE_URL in .env');
        console.error(err);
        process.exit(1);
    }
}

startServer();