const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        is: /^[a-zA-Z0-9_-]*$/,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profileImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ["user"],
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
    },
  }
);

// Instance method to check password validity
User.prototype.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Instance method to generate Email Verification token
User.prototype.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Token expires in 24 hours
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return token; // Return unhashed token to send in email
};

// Instance method to generate password reset token
User.prototype.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  return token; // Return unhashed token to send in email
};

// Static method to find user by email verification token
User.findByVerificationToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return await User.findOne({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { [require("sequelize").Op.gt]: Date.now() },
    },
  });
};

// Static method to find user by password reset token
User.findByResetToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return await User.findOne({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { [require("sequelize").Op.gt]: Date.now() },
    },
  });
};

// Instance method to generate safe user object (without sensitive data)
User.prototype.toSafeObject = function () {
  const {
    id,
    username,
    email,
    fullName,
    bio,
    profileImageUrl,
    roles,
    created_at,
    updated_at,
  } = this;

  return {
    id,
    username,
    email,
    fullName,
    bio,
    profileImageUrl,
    roles,
    created_at,
    updated_at,
  };
};

module.exports = User;
