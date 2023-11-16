const mongoose = require("mongoose");

// Define possible bid statuses and operations
const bidStatusEnum = ["Active", "Withdraw", "Rejected"];
const bidOperationEnum = ["Evaluating", "OnHold", "Active", "Reject"];

// Assuming your Offer model is defined in a file named 'Offer.js' in the same directory
const Offer = require("./Offer").Offer; // Adjust the path as necessary

const bidSchema = new mongoose.Schema({
  offerId: {
    type: String, // Use ObjectId type for referencing another document
    ref: "Offer", // Reference to the Offer model
  },
  traderId: { type: String, required: true },
  traderemail: { type: String, required: true },
  bidAmount: { type: Number, required: true },
  traderCompany: { type: String, required: true },
  status: {
    type: String,
    enum: bidStatusEnum,
    default: "Active",
  },
  operation: {
    type: String,
    enum: bidOperationEnum,
    default: "Evaluating",
  },
  // No need to store offerData here, it will be populated from the Offer model
});

// Create the Bid model from the schema
const Bid = mongoose.model("Bid", bidSchema);

// Export the Bid model
module.exports = { Bid };
