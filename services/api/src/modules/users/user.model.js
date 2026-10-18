import mongoose from "mongoose";

const { Schema } = mongoose;

const addressSubSchema = new Schema(
  {
    label: { type: String, default: "Home" },
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: "India" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String, default: "" },

    role: { type: Schema.Types.ObjectId, ref: "Role", required: true },

    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },

    addresses: { type: [addressSubSchema], default: [] },

    // Role-specific profile references
    sellerProfile: { type: Schema.Types.ObjectId, ref: "Store" },
    deliveryProfile: { type: Schema.Types.ObjectId, ref: "DeliveryProfile" },

    lastLoginAt: { type: Date },
    refreshTokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ "addresses.location": "2dsphere" });

export const User = mongoose.model("User", userSchema);
