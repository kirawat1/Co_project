// Backend/config/prismaClient.js (Final Fix for Simplicity)

const { PrismaClient } = require('@prisma/client');


// สร้าง Client โดยอาศัย Environment Variables ที่ถูกโหลดใน server.js
const prisma = new PrismaClient(); 

module.exports = prisma;