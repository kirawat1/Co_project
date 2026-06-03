// Backend/scripts/hash_password.js
// Usage: node scripts/hash_password.js <password>

const bcrypt = require('bcryptjs');

const PASSWORD = process.argv[2];
if (!PASSWORD) {
  console.error('Usage: node scripts/hash_password.js <password>');
  process.exit(1);
}

bcrypt.hash(PASSWORD, 13).then(hash => {
    console.log('----------------------------------------------------');
    console.log('HASHED PASSWORD (คัดลอกค่านี้ไปใช้ใน MySQL):');
    console.log(hash);
    console.log('----------------------------------------------------');
    process.exit();
}).catch(err => {
    console.error('Hashing failed:', err);
    process.exit(1);
});
