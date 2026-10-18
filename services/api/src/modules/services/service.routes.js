import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS } from "@meiteimart/shared";
import { Service } from "./service.model.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermissions } from "../../middlewares/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

const router = Router();
const serviceSchema = z.object({
  number: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  booking: z.string().trim().optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const services = await Service.find({ isActive: true }).sort({ sortOrder: 1, number: 1 });
    return sendSuccess(res, { data: { services } });
  })
);

router.get(
  "/manage",
  requireAuth(),
  requirePermissions(PERMISSIONS.SERVICE_MANAGE),
  asyncHandler(async (req, res) => {
    const services = await Service.find().sort({ sortOrder: 1, number: 1 });
    return sendSuccess(res, { data: { services } });
  })
);

router.post(
  "/",
  requireAuth(),
  requirePermissions(PERMISSIONS.SERVICE_MANAGE),
  asyncHandler(async (req, res) => {
    const body = serviceSchema.parse(req.body);
    const exists = await Service.findOne({ slug: body.slug });
    if (exists) throw ApiError.conflict("A service with this slug already exists");
    const service = await Service.create(body);
    return sendSuccess(res, { statusCode: 201, data: { service }, message: "Service created" });
  })
);

router.patch(
  "/:id",
  requireAuth(),
  requirePermissions(PERMISSIONS.SERVICE_MANAGE),
  asyncHandler(async (req, res) => {
    const body = serviceSchema.partial().parse(req.body);
    if (body.slug) {
      const duplicate = await Service.findOne({ slug: body.slug, _id: { $ne: req.params.id } });
      if (duplicate) throw ApiError.conflict("A service with this slug already exists");
    }
    const service = await Service.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!service) throw ApiError.notFound("Service not found");
    return sendSuccess(res, { data: { service }, message: "Service updated" });
  })
);

router.delete(
  "/:id",
  requireAuth(),
  requirePermissions(PERMISSIONS.SERVICE_MANAGE),
  asyncHandler(async (req, res) => {
    const service = await Service.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!service) throw ApiError.notFound("Service not found");
    return sendSuccess(res, { data: { service }, message: "Service deactivated" });
  })
);

export default router;
