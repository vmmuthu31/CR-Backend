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

const traderSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [emailDomainValidator, "Email domain already registered"],
  },
  password: {
    // This will be set by the admin
    type: String,
    required: true,
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  creditOffers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
  ],
});

module.exports = mongoose.model("Trader", traderSchema);
