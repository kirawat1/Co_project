// __tests__/setup.js — ตั้งค่า env ก่อนรัน tests ทั้งหมด
process.env.JWT_SECRET = 'test_secret_key_for_jest_testing_only_32chars';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db';
process.env.PORT = '5001';
process.env.FRONTEND_URL = 'http://localhost:5173';
