const mongoose = require("mongoose");

const projectDataSchema = new mongoose.Schema({
  ProjectID: String,
  Standard: String,
  ID: Number,
  Name: String,
  Proponent: String,
  ProjectType: String,
  Methodology: String,
  Country_Area: String,
  SDGs: String,

  AdditionalAttributes: {
    Attribute1: String,
    Attribute2: String,
    Attribute3: String,
  },
});

module.exports = mongoose.model("ProjectData", projectDataSchema);
