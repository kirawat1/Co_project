// backend/routes/auth.js
const express = require("express");
const { signIn, getProfile ,loginWithSSO} = require("../controllers/authController");


const router = express.Router();


router.post("/signin", signIn);

router.post("/login/sso", loginWithSSO);

router.get("/me", getProfile); 


module.exports = router;

