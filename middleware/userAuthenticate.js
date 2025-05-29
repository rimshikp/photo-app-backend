const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const userAuthenticate = () => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
    } else {
      const token = authHeader.split(" ")[1];

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded) {
          return res
            .status(401)
            .json({ status: false, message: "Unauthorized: Invalid token" });
        }

        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };

        next();
      } catch (err) {
        return res.status(401).json({
          status: false,
          message: "Unauthorized: Invalid or expired token",
        });
      }
    }
  };
};

module.exports = userAuthenticate;
