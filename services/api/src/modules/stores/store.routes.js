import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, SELLER_STATUS } from "@meiteimart/shared";
import { Store } from "./store.model.js";
import { User } from "../users/user.model.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermissions } from "../../middlewares/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const router = Router();

// Public, Swiggy/Zomato-style discovery: "stores near me", sorted by distance, with a
// rough ETA per store. No auth required so customers can browse before signing in.
router.get(
  "/nearby",
  asyncHandler(async (req, res) => {
    const { lat, lng, radiusKm = 10 } = req.query;
    if (!lat || !lng) throw ApiError.badRequest("lat and lng query params are required");

    const stores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [Number(lng), Number(lat)] },
          distanceField: "distanceMeters",
          maxDistance: Number(radiusKm) * 1000,
          spherical: true,
          query: { status: SELLER_STATUS.APPROVED, isServiceable: true },
        },
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: 50 },
      {
        $project: {
          name: 1,
          description: 1,
          logoUrl: 1,
          address: 1,
          rating: 1,
          ratingCount: 1,
          minOrderValue: 1,
          deliveryFee: 1,
          freeDeliveryThreshold: 1,
          avgPrepTimeMinutes: 1,
          distanceMeters: 1,
        },
      },
    ]);

    const withEta = stores.map((store) => {
      const distanceKm = store.distanceMeters / 1000;
      const travelMinutes = (distanceKm / 22) * 60;
      const etaMinutes = Math.max(10, Math.round(travelMinutes + (store.avgPrepTimeMinutes || 15)));
      return { ...store, distanceKm: Number(distanceKm.toFixed(2)), etaMinutes };
    });

    return sendSuccess(res, { data: { stores: withEta } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    if (req.params.id === "me") return next();
    const store = await Store.findOne({
      _id: req.params.id,
      status: SELLER_STATUS.APPROVED,
      isServiceable: true,
    }).select(
      "name description logoUrl address rating ratingCount minOrderValue deliveryFee freeDeliveryThreshold avgPrepTimeMinutes openingHours"
    );
    if (!store) throw ApiError.notFound("Store not found");
    return sendSuccess(res, { data: { store } });
  })
);

router.use(requireAuth());

const storeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  gstNumber: z.string().optional(),
  minOrderValue: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  freeDeliveryThreshold: z.number().nonnegative().optional(),
  avgPrepTimeMinutes: z.number().positive().optional(),
  openingHours: z.object({ open: z.string(), close: z.string() }).optional(),
  address: z
    .object({
      line1: z.string().trim().min(3),
      city: z.string().trim().min(2),
      state: z.string().trim().min(2),
      postalCode: z.string().trim().min(4),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

// Seller onboarding — a SELLER user creates their store profile (pending admin approval).
router.post(
  "/",
  requirePermissions(PERMISSIONS.STORE_MANAGE),
  asyncHandler(async (req, res) => {
    const body = storeSchema.parse(req.body);
    const existing = await Store.findOne({ owner: req.user.id });
    if (existing) throw ApiError.conflict("You already have a store");

    const store = await Store.create({
      owner: req.user.id,
      name: body.name,
      description: body.description,
      logoUrl: body.logoUrl,
      gstNumber: body.gstNumber,
      minOrderValue: body.minOrderValue,
      deliveryFee: body.deliveryFee,
      freeDeliveryThreshold: body.freeDeliveryThreshold,
      avgPrepTimeMinutes: body.avgPrepTimeMinutes,
      address: body.address && {
        line1: body.address.line1,
        city: body.address.city,
        state: body.address.state,
        postalCode: body.address.postalCode,
        location: { type: "Point", coordinates: [body.address.lng || 0, body.address.lat || 0] },
      },
    });
    await User.findByIdAndUpdate(req.user.id, { sellerProfile: store._id });
    return sendSuccess(res, { statusCode: 201, data: { store }, message: "Store submitted for approval" });
  })
);

router.get(
  "/me",
  requirePermissions(PERMISSIONS.STORE_MANAGE),
  asyncHandler(async (req, res) => {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) throw ApiError.notFound("No store found for this seller");
    return sendSuccess(res, { data: { store } });
  })
);

router.patch(
  "/me",
  requirePermissions(PERMISSIONS.STORE_MANAGE),
  asyncHandler(async (req, res) => {
    const body = storeSchema.partial().parse(req.body);
    const update = { ...body };
    if (body.address) {
      update.address = {
        line1: body.address.line1,
        city: body.address.city,
        state: body.address.state,
        postalCode: body.address.postalCode,
        location: { type: "Point", coordinates: [body.address.lng, body.address.lat] },
      };
    }
    const store = await Store.findOneAndUpdate({ owner: req.user.id }, update, { new: true, runValidators: true });
    if (!store) throw ApiError.notFound("No store found for this seller");
    return sendSuccess(res, { data: { store }, message: "Store updated" });
  })
);

// Admin: list & approve/suspend seller stores
router.get(
  "/",
  requirePermissions(PERMISSIONS.STORE_APPROVE),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const stores = await Store.find(filter).populate("owner", "name email phone").sort({ createdAt: -1 });
    return sendSuccess(res, { data: { stores } });
  })
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.STORE_APPROVE),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(Object.values(SELLER_STATUS)) }).parse(req.body);
    const store = await Store.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!store) throw ApiError.notFound("Store not found");
    return sendSuccess(res, { data: { store }, message: `Store ${status.toLowerCase()}` });
  })
);

export default router;
