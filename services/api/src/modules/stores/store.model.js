import mongoose from "mongoose";
import { SELLER_STATUS } from "@meiteimart/shared";

const { Schema } = mongoose;

const storeSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    status: { type: String, enum: Object.values(SELLER_STATUS), default: SELLER_STATUS.PENDING_APPROVAL },
    address: {
      line1: String,
      city: String,
      state: String,
      postalCode: String,
      location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    isServiceable: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    minOrderValue: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 15, min: 0 },
    freeDeliveryThreshold: { type: Number, default: 199, min: 0 },
    avgPrepTimeMinutes: { type: Number, default: 15 },
    openingHours: {
      open: { type: String, default: "09:00" }, // "HH:mm", 24h
      close: { type: String, default: "22:00" },
    },
  },
  { timestamps: true }
);

storeSchema.index({ "address.location": "2dsphere" });

export const Store = mongoose.model("Store", storeSchema);
