import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, SELLER_STATUS } from "@meiteimart/shared";
import { Product } from "./product.model.js";
import { Store } from "../stores/store.model.js";
import { Category } from "../categories/category.model.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermissions } from "../../middlewares/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const router = Router();

const productSchema = z.object({
  category: z.string(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  unit: z.string().optional(),
  mrp: z.number().positive(),
  price: z.number().positive(),
  stock: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
});

// Public storefront listing (customer web/mobile)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { category, store, search, page = 1, limit = 24 } = req.query;
    const filter = { isActive: true, isApproved: true };
    if (category) {
      const categoryFilter = [{ slug: String(category) }];
      if (/^[a-f\d]{24}$/i.test(String(category))) categoryFilter.push({ _id: category });
      const matchedCategory = await Category.findOne({ $or: categoryFilter, isActive: true }).select("_id");
      if (!matchedCategory) {
        return sendSuccess(res, {
          data: { products: [], total: 0, page: Number(page), limit: Number(limit) },
        });
      }
      filter.category = matchedCategory._id;
    }
    if (store) filter.store = store;
    if (search) filter.$text = { $search: String(search) };

    const serviceableStores = await Store.find({
      status: SELLER_STATUS.APPROVED,
      isServiceable: true,
      ...(store ? { _id: store } : {}),
    }).select("_id");
    if (serviceableStores.length === 0) {
      return sendSuccess(res, {
        data: { products: [], total: 0, page: Number(page), limit: Number(limit) },
      });
    }
    filter.store = { $in: serviceableStores.map((item) => item._id) };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("store", "name description logoUrl address rating ratingCount minOrderValue deliveryFee freeDeliveryThreshold avgPrepTimeMinutes")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Product.countDocuments(filter);
    return sendSuccess(res, { data: { products, total, page: Number(page), limit: Number(limit) } });
  })
);

router.get(
  "/manage",
  requireAuth(),
  requirePermissions(PERMISSIONS.PRODUCT_APPROVE),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 100, status } = req.query;
    const filter = {};
    if (status === "pending") filter.isApproved = false;
    if (status === "approved") filter.isApproved = true;
    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("store", "name")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Product.countDocuments(filter);
    return sendSuccess(res, { data: { products, total, page: Number(page), limit: Number(limit) } });
  })
);

router.get(
  "/mine",
  requireAuth(),
  requirePermissions(PERMISSIONS.PRODUCT_READ),
  asyncHandler(async (req, res) => {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) throw ApiError.notFound("No store found for this seller");
    const products = await Product.find({ store: store._id })
      .populate("category", "name slug")
      .sort({ createdAt: -1 });
    return sendSuccess(res, { data: { products } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate("category").populate("store", "name logoUrl rating");
    if (!product) throw ApiError.notFound("Product not found");
    return sendSuccess(res, { data: { product } });
  })
);

router.use(requireAuth());

// Sellers create products for their own store; Admins can create/approve for any store.
router.post(
  "/",
  requirePermissions(PERMISSIONS.PRODUCT_CREATE),
  asyncHandler(async (req, res) => {
    const body = productSchema.parse(req.body);
    let storeId = req.body.store;

    if (!req.user.isSuperAdmin && req.user.role === "SELLER") {
      const store = await Store.findOne({ owner: req.user.id });
      if (!store) throw ApiError.badRequest("Seller has no store yet");
      storeId = store._id;
    }
    if (!storeId) throw ApiError.badRequest("store is required");
    const category = await Category.findOne({ _id: body.category, isActive: true }).select("_id");
    if (!category) throw ApiError.badRequest("Select an active product category");

    const product = await Product.create({
      ...body,
      category: category._id,
      store: storeId,
      isApproved: req.user.isSuperAdmin || req.user.role === "ADMIN",
    });
    return sendSuccess(res, { statusCode: 201, data: { product }, message: "Product created" });
  })
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.PRODUCT_UPDATE),
  asyncHandler(async (req, res) => {
    const body = productSchema.partial().parse(req.body);
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound("Product not found");

    if (req.user.role === "SELLER" && !req.user.isSuperAdmin) {
      const store = await Store.findOne({ owner: req.user.id });
      if (!store || String(product.store) !== String(store._id)) {
        throw ApiError.forbidden("You can only edit your own products");
      }
    }

    if (body.category) {
      const category = await Category.findOne({ _id: body.category, isActive: true }).select("_id");
      if (!category) throw ApiError.badRequest("Select an active product category");
    }

    Object.assign(product, body);
    await product.save();
    return sendSuccess(res, { data: { product }, message: "Product updated" });
  })
);

router.patch(
  "/:id/approve",
  requirePermissions(PERMISSIONS.PRODUCT_APPROVE),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!product) throw ApiError.notFound("Product not found");
    return sendSuccess(res, { data: { product }, message: "Product approved" });
  })
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.PRODUCT_DELETE),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) throw ApiError.notFound("Product not found");
    return sendSuccess(res, { message: "Product deactivated" });
  })
);

export default router;
