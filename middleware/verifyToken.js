const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).send({ error: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, "YOUR_SECRET_KEY"); // Use the same secret key as in the login route
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ error: "Invalid token" });
  }
};
