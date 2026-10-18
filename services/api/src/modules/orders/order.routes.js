import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, ORDER_STATUS, ORDER_STATUS_FLOW, SELLER_STATUS, SOCKET_EVENTS } from "@meiteimart/shared";
import { Order } from "./order.model.js";
import { Product } from "../products/product.model.js";
import { DeliveryProfile } from "../delivery/deliveryProfile.model.js";
import { Store } from "../stores/store.model.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermissions } from "../../middlewares/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateOrderNumber } from "../../utils/crypto.js";
import { getIo } from "../../sockets/index.js";

const router = Router();
router.use(requireAuth());

const createOrderSchema = z.object({
  store: z.string(),
  items: z.array(z.object({ product: z.string(), quantity: z.number().int().positive() })).min(1),
  shippingAddress: z.object({
    label: z.string().optional(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  paymentMethod: z.enum(["COD", "ONLINE", "WALLET"]).default("COD"),
});

router.post(
  "/",
  requirePermissions(PERMISSIONS.ORDER_CREATE),
  asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body);

    const store = await Store.findOne({
      _id: body.store,
      status: SELLER_STATUS.APPROVED,
      isServiceable: true,
    });
    if (!store) throw ApiError.badRequest("This store is not available for delivery");

    const requestedQuantities = new Map();
    for (const item of body.items) {
      requestedQuantities.set(item.product, (requestedQuantities.get(item.product) || 0) + item.quantity);
    }
    const products = await Product.find({
      _id: { $in: [...requestedQuantities.keys()] },
      store: store._id,
      isActive: true,
      isApproved: true,
    });
    if (products.length !== requestedQuantities.size) {
      throw ApiError.badRequest("One or more products are no longer available from this store");
    }

    const items = [...requestedQuantities].map(([productId, quantity]) => {
      const product = products.find((p) => String(p._id) === productId);
      if (product.stock < quantity) throw ApiError.badRequest(`Insufficient stock for ${product.name}`);
      return {
        product: product._id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        quantity,
      };
    });

    const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (itemsTotal < store.minOrderValue) {
      throw ApiError.badRequest(`This store has a minimum order value of ₹${store.minOrderValue}`);
    }
    const deliveryFee =
      store.freeDeliveryThreshold > 0 && itemsTotal >= store.freeDeliveryThreshold
        ? 0
        : store.deliveryFee;
    const grandTotal = itemsTotal + deliveryFee;

    const reservedItems = [];
    for (const item of items) {
      const reservation = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity }, isActive: true, isApproved: true },
        { $inc: { stock: -item.quantity } }
      );
      if (reservation.modifiedCount !== 1) {
        await Promise.all(
          reservedItems.map((reserved) =>
            Product.updateOne({ _id: reserved.product }, { $inc: { stock: reserved.quantity } })
          )
        );
        throw ApiError.badRequest(`Insufficient stock for ${item.name}`);
      }
      reservedItems.push(item);
    }

    let order;
    try {
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        customer: req.user.id,
        store: store._id,
        items,
        itemsTotal,
        deliveryFee,
        grandTotal,
        shippingAddress: {
          ...body.shippingAddress,
          location: { type: "Point", coordinates: [body.shippingAddress.lng || 0, body.shippingAddress.lat || 0] },
        },
        paymentMethod: body.paymentMethod,
        status: ORDER_STATUS.PLACED,
        statusHistory: [{ status: ORDER_STATUS.PLACED }],
      });
    } catch (error) {
      await Promise.all(
        reservedItems.map((reserved) =>
          Product.updateOne({ _id: reserved.product }, { $inc: { stock: reserved.quantity } })
        )
      );
      throw error;
    }

    getIo()?.to(`store:${body.store}`).emit(SOCKET_EVENTS.ORDER_CREATED, { orderId: order._id, orderNumber: order.orderNumber });

    return sendSuccess(res, { statusCode: 201, data: { order }, message: "Order placed" });
  })
);

router.get(
  "/",
  requirePermissions(PERMISSIONS.ORDER_READ_OWN),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === "CUSTOMER") filter.customer = req.user.id;
    if (req.user.role === "DELIVERY_PARTNER") filter.deliveryPartner = req.user.id;
    if (req.user.role === "SELLER" && req.user.sellerProfile) filter.store = req.user.sellerProfile;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate("store", "name").limit(100);
    return sendSuccess(res, { data: { orders } });
  })
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.ORDER_READ_OWN),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate("store", "name logoUrl address")
      .populate("deliveryPartner", "name phone")
      .populate("customer", "name phone");
    if (!order) throw ApiError.notFound("Order not found");
    return sendSuccess(res, { data: { order } });
  })
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.ORDER_UPDATE_STATUS),
  asyncHandler(async (req, res) => {
    const { status, note } = z
      .object({ status: z.enum(Object.values(ORDER_STATUS)), note: z.string().optional() })
      .parse(req.body);

    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    order.status = status;
    order.statusHistory.push({ status, note });
    await order.save();

    getIo()?.to(`order:${order._id}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED, { orderId: order._id, status });

    return sendSuccess(res, { data: { order }, message: "Order status updated" });
  })
);

router.patch(
  "/:id/assign-delivery",
  requirePermissions(PERMISSIONS.ORDER_ASSIGN_DELIVERY),
  asyncHandler(async (req, res) => {
    const { deliveryPartnerId } = z.object({ deliveryPartnerId: z.string() }).parse(req.body);
    const profile = await DeliveryProfile.findOne({ user: deliveryPartnerId });
    if (!profile?.isApproved) throw ApiError.badRequest("Delivery partner not approved");

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        deliveryPartner: deliveryPartnerId,
        status: ORDER_STATUS.ASSIGNED_TO_DELIVERY,
        $push: { statusHistory: { status: ORDER_STATUS.ASSIGNED_TO_DELIVERY } },
      },
      { new: true }
    );
    if (!order) throw ApiError.notFound("Order not found");

    getIo()?.to(`user:${deliveryPartnerId}`).emit(SOCKET_EVENTS.ORDER_ASSIGNED, { orderId: order._id });
    getIo()?.to(`order:${order._id}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });

    return sendSuccess(res, { data: { order }, message: "Delivery partner assigned" });
  })
);

router.patch(
  "/:id/cancel",
  requirePermissions(PERMISSIONS.ORDER_CANCEL),
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (ORDER_STATUS_FLOW.indexOf(order.status) > 2) {
      throw ApiError.badRequest("Order can no longer be cancelled");
    }
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelReason = reason || "";
    order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, note: reason });
    await order.save();

    getIo()?.to(`order:${order._id}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    return sendSuccess(res, { data: { order }, message: "Order cancelled" });
  })
);

// Swiggy/Zomato-style delivery marketplace: instead of only admin-assigning a rider,
// available (unassigned, packed) orders near a delivery partner's current location are
// listed so the partner can self-claim the one they want.
router.get(
  "/available-for-delivery",
  requirePermissions(PERMISSIONS.DELIVERY_CLAIM),
  asyncHandler(async (req, res) => {
    const profile = await DeliveryProfile.findOne({ user: req.user.id });
    if (!profile) throw ApiError.badRequest("Complete your delivery partner profile first");

    const [lng, lat] = profile.currentLocation?.coordinates || [0, 0];
    const radiusKm = Number(req.query.radiusKm) || 8;

    const orders = await Order.aggregate([
      { $match: { status: ORDER_STATUS.PACKED, deliveryPartner: null } },
      {
        $lookup: {
          from: "stores",
          localField: "store",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: "$store" },
      ...(lat && lng
        ? [
            {
              $addFields: {
                distanceMeters: {
                  $let: {
                    vars: { coords: "$store.address.location.coordinates" },
                    in: {
                      $multiply: [
                        6371000,
                        {
                          $acos: {
                            $min: [
                              1,
                              {
                                $add: [
                                  {
                                    $multiply: [
                                      { $sin: { $degreesToRadians: lat } },
                                      { $sin: { $degreesToRadians: { $arrayElemAt: ["$$coords", 1] } } },
                                    ],
                                  },
                                  {
                                    $multiply: [
                                      { $cos: { $degreesToRadians: lat } },
                                      { $cos: { $degreesToRadians: { $arrayElemAt: ["$$coords", 1] } } },
                                      { $cos: { $degreesToRadians: { $subtract: [{ $arrayElemAt: ["$$coords", 0] }, lng] } } },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
            { $match: { distanceMeters: { $lte: radiusKm * 1000 } } },
            { $sort: { distanceMeters: 1 } },
          ]
        : []),
      { $limit: 30 },
    ]);

    return sendSuccess(res, { data: { orders } });
  })
);

router.patch(
  "/:id/claim",
  requirePermissions(PERMISSIONS.DELIVERY_CLAIM),
  asyncHandler(async (req, res) => {
    const profile = await DeliveryProfile.findOne({ user: req.user.id });
    if (!profile?.isApproved) throw ApiError.forbidden("Your delivery profile is not approved yet");

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, deliveryPartner: null, status: ORDER_STATUS.PACKED },
      {
        deliveryPartner: req.user.id,
        status: ORDER_STATUS.ASSIGNED_TO_DELIVERY,
        $push: { statusHistory: { status: ORDER_STATUS.ASSIGNED_TO_DELIVERY, note: "Self-claimed by delivery partner" } },
      },
      { new: true }
    );
    if (!order) throw ApiError.conflict("This order was already claimed by another delivery partner");

    getIo()?.to(`order:${order._id}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    return sendSuccess(res, { data: { order }, message: "Order claimed" });
  })
);

// Post-delivery ratings (customer rates the store + the delivery partner), updating
// each party's running average — same loop as Swiggy/Zomato's post-order rating prompt.
router.post(
  "/:id/rate",
  requirePermissions(PERMISSIONS.ORDER_RATE),
  asyncHandler(async (req, res) => {
    const { storeRating, deliveryRating, comment } = z
      .object({
        storeRating: z.number().min(1).max(5).optional(),
        deliveryRating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
      })
      .parse(req.body);

    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("You can only rate your own orders");
    if (order.status !== ORDER_STATUS.DELIVERED) throw ApiError.badRequest("You can only rate delivered orders");
    if (order.rating?.ratedAt) throw ApiError.conflict("This order has already been rated");

    order.rating = { storeRating, deliveryRating, comment: comment || "", ratedAt: new Date() };
    await order.save();

    if (storeRating) {
      const store = await Store.findById(order.store);
      if (store) {
        const total = store.rating * store.ratingCount + storeRating;
        store.ratingCount += 1;
        store.rating = Number((total / store.ratingCount).toFixed(2));
        await store.save();
      }
    }

    if (deliveryRating && order.deliveryPartner) {
      const profile = await DeliveryProfile.findOne({ user: order.deliveryPartner });
      if (profile) {
        const total = profile.rating * profile.ratingCount + deliveryRating;
        profile.ratingCount += 1;
        profile.rating = Number((total / profile.ratingCount).toFixed(2));
        await profile.save();
      }
    }

    return sendSuccess(res, { data: { order }, message: "Thanks for your feedback!" });
  })
);

export default router;
