const mongoose = require("mongoose");

const getDomainFromEmail = (email) => email.split("@")[1];

const emailDomainValidator = async function (email) {
  const domain = getDomainFromEmail(email);
  const adminCount = await mongoose
    .model("Admin")
    .countDocuments({ email: new RegExp("@" + domain + "$", "i") });
  const traderCount = await mongoose
    .model("Trader")
    .countDocuments({ email: new RegExp("@" + domain + "$", "i") });
  return adminCount + traderCount === 0;
};

// models/Admin.js
const adminSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    unique: true,
  },
  personName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [emailDomainValidator, "Email domain already registered"],
  },
  location: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Admin", adminSchema);
