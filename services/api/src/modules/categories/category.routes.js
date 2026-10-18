import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS } from "@meiteimart/shared";
import { Category } from "./category.model.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermissions } from "../../middlewares/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const router = Router();

const categorySchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  imageUrl: z.string().optional(),
  parent: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

// Public: anyone (customer web/mobile) can browse the catalogue tree.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    return sendSuccess(res, { data: { categories } });
  })
);

router.use(requireAuth());

router.post(
  "/",
  requirePermissions(PERMISSIONS.CATEGORY_CREATE),
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const exists = await Category.findOne({ slug: body.slug });
    if (exists) throw ApiError.conflict("A category with this slug already exists");
    const category = await Category.create(body);
    return sendSuccess(res, { statusCode: 201, data: { category }, message: "Category created" });
  })
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.CATEGORY_UPDATE),
  asyncHandler(async (req, res) => {
    const body = categorySchema.partial().parse(req.body);
    if (body.slug) {
      const duplicate = await Category.findOne({ slug: body.slug, _id: { $ne: req.params.id } });
      if (duplicate) throw ApiError.conflict("A category with this slug already exists");
    }
    const category = await Category.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!category) throw ApiError.notFound("Category not found");
    return sendSuccess(res, { data: { category }, message: "Category updated" });
  })
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.CATEGORY_DELETE),
  asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) throw ApiError.notFound("Category not found");
    return sendSuccess(res, { message: "Category deactivated" });
  })
);

export default router;
