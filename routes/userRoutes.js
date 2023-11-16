const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const Trader = require("../models/Trader");
const router = express.Router();
const jwt = require("jsonwebtoken");

// Signup route for admin
router.post("/signup", async (req, res) => {
  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const admin = new Admin({
      ...req.body,
      password: hashedPassword,
    });
    await admin.save();
    res.status(201).send({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Invite trader by admin
router.post("/invite", async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.body.adminEmail });
    if (!admin) {
      return res.status(404).send({ error: "Admin not found" });
    }

    // Generate a random password for the trader
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Extract trader's name from the email
    const traderName = req.body.traderEmail.split("@")[0];
    const adminEmail = req.body.adminEmail;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "zkconnectt@gmail.com",
        pass: "yslzyadcmvewlmmn",
      },
    });
    const mailOptions = {
      from: "carbon-relay@gmail.com",
      to: req.body.traderEmail,
      subject: "Invitation to join the Carbon-Relay Dashboard",
      html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; max-width: 600px; margin: 20px auto; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">Welcome, ${traderName}!</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #555;">
              You have been invited to the <strong>Carbon-Relay Dashboard</strong> by <span style="color: #007BFF;">${adminEmail}</span>.
          </p>
          <a href="https://c-dash.vercel.app/" style="display: inline-block; background-color: #007BFF; color: #fff; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin: 20px 0;">Access Dashboard</a>
          <p style="font-size: 16px; line-height: 1.5; color: #555;">
              Your temporary password is: <strong>${randomPassword}</strong>
          </p>
          <p style="font-size: 14px; color: #888; border-top: 1px solid #e0e0e0; padding-top: 20px;">
              Please change your password once you log in for the first time.
          </p>
      </div>
  `,
    };

    await transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        return res.status(500).send({ error: error.message });
      }

      const trader = new Trader({
        companyName: admin.companyName,
        email: req.body.traderEmail,
        password: hashedPassword,
        admin: admin.id,
      });
      await trader.save();

      res.send({ message: "Invitation sent successfully" });
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await Admin.findOne({ email });
    let userType = "Admin";

    if (!user) {
      user = await Trader.findOne({ email });
      userType = "Trader";
    }

    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ error: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, userType: userType },
      "YOUR_SECRET_KEY", // This should be stored in an environment variable for security
      { expiresIn: "1h" }
    );

    let responseData = {
      message: "Logged in successfully",
      token: token,
      user: {
        id: user._id,
        email: user.email,
      },
    };

    if (userType === "Admin") {
      responseData.user.companyName = user.companyName;
      responseData.user.personName = user.personName;
      responseData.user.location = user.location;
      responseData.user.email = user.email;
      responseData.user.role = "Admin";
    } else if (userType === "Trader") {
      responseData.user.companyName = user.companyName;
      responseData.user.email = user.email;
      responseData.user.role = "Trader";
    }

    res.send(responseData);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
