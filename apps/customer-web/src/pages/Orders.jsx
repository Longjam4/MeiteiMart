import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

const STATUS_STEPS = [
  { key: "PLACED", label: "Order Placed", icon: "📝" },
  { key: "CONFIRMED", label: "Confirmed", icon: "✅" },
  { key: "PACKED", label: "Packed", icon: "📦" },
  { key: "ASSIGNED_TO_DELIVERY", label: "Out for Pickup", icon: "🛵" },
  { key: "OUT_FOR_DELIVERY", label: "On the Way", icon: "🛵" },
  { key: "DELIVERED", label: "Delivered", icon: "🎉" },
];

function getStatusIndex(status) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingErrors, setRatingErrors] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [loadError, setLoadError] = useState("");
  const navigate = useNavigate();

  async function load() {
    try {
      const res = await api.get("/orders");
      setOrders(res.data.data.orders);
      setLoadError("");
    } catch (error) {
      setOrders([]);
      setLoadError(getApiErrorMessage(error, "Unable to load your orders."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    orders.forEach((o) => socket.emit("order:join", o._id));

    function onLocation({ orderId, lat, lng }) {
      setTracking((prev) => ({ ...prev, [orderId]: { lat, lng } }));
    }
    function onStatus() {
      load();
    }
    socket.on("delivery:location-broadcast", onLocation);
    socket.on("order:status-updated", onStatus);
    return () => {
      socket.off("delivery:location-broadcast", onLocation);
      socket.off("order:status-updated", onStatus);
    };
  }, [orders]);

  function updateDraft(orderId, patch) {
    setRatingDrafts((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function submitRating(orderId) {
    const draft = ratingDrafts[orderId] || {};
    setSubmitting(orderId);
    setRatingErrors((prev) => ({ ...prev, [orderId]: "" }));
    try {
      await api.post(`/orders/${orderId}/rate`, draft);
      await load();
    } catch (error) {
      setRatingErrors((prev) => ({
        ...prev,
        [orderId]: getApiErrorMessage(error, "Unable to submit your rating."),
      }));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-20 sm:pb-8">
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
        {loadError && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
        )}
        <div className="space-y-4">
          {orders.map((o) => {
            const currentStep = getStatusIndex(o.status);
            const isCancelled = o.status === "CANCELLED";
            const isTrackable = ["ASSIGNED_TO_DELIVERY", "OUT_FOR_DELIVERY"].includes(o.status);
            const canRate = o.status === "DELIVERED" && !o.rating?.ratedAt;
            const draft = ratingDrafts[o._id] || {};

            return (
              <div key={o._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-fade-in">
                {/* Order header */}
                <div className="p-4 border-b border-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className="font-bold text-base">{o.orderNumber}</p>
                      <p className="text-xs text-gray-500">{o.store?.name}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isCancelled ? "bg-red-100 text-red-700" :
                      o.status === "DELIVERED" ? "bg-green-100 text-green-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {isCancelled ? "Cancelled" : o.status === "DELIVERED" ? "Delivered" : "In Progress"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} •{" "}
                    {new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {/* Items */}
                <div className="px-4 py-3 border-b border-gray-50">
                  {o.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.quantity}× {item.name}</span>
                      <span className="text-gray-700">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="px-4 py-3 border-b border-gray-50 flex justify-between font-bold">
                  <span>Total Paid</span>
                  <span>₹{o.grandTotal}</span>
                </div>

                {/* Tracking timeline */}
                {!isCancelled && o.status !== "DELIVERED" && (
                  <div className="px-4 py-4 bg-gray-50">
                    <p className="text-sm font-semibold mb-3">Order Status</p>
                    <div className="flex items-center justify-between">
                      {STATUS_STEPS.slice(0, 5).map((step, idx) => (
                        <div key={step.key} className="flex flex-col items-center flex-1 relative">
                          {idx < 4 && (
                            <div className={`absolute top-4 left-1/2 w-full h-0.5 ${idx < currentStep ? "bg-brand-500" : "bg-gray-200"}`} />
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm z-10 ${
                            idx <= currentStep ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-400"
                          }`}>
                            {idx <= currentStep ? "✓" : idx + 1}
                          </div>
                          <span className={`text-xs mt-1 text-center ${idx <= currentStep ? "text-brand-600 font-medium" : "text-gray-400"}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    {isTrackable && !tracking[o._id] && (
                      <p className="text-xs text-gray-500 mt-3 text-center animate-pulse-dot">
                        Waiting for delivery partner to share live location...
                      </p>
                    )}
                  </div>
                )}

                {/* Rating section */}
                {canRate && (
                  <div className="px-4 py-4 border-t border-gray-50">
                    <p className="font-semibold text-sm mb-3">Rate your order</p>
                    <div className="flex gap-6 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Store</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => updateDraft(o._id, { storeRating: n })}
                              className={`text-2xl transition-transform hover:scale-110 ${(draft.storeRating || 0) >= n ? "opacity-100" : "opacity-30"}`}
                            >
                              ⭐
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Delivery</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => updateDraft(o._id, { deliveryRating: n })}
                              className={`text-2xl transition-transform hover:scale-110 ${(draft.deliveryRating || 0) >= n ? "opacity-100" : "opacity-30"}`}
                            >
                              ⭐
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <textarea
                      placeholder="Add a comment (optional)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      rows={2}
                      value={draft.comment || ""}
                      onChange={(e) => updateDraft(o._id, { comment: e.target.value })}
                    />
                    <button
                      onClick={() => submitRating(o._id)}
                      disabled={submitting === o._id || (!draft.storeRating && !draft.deliveryRating)}
                      className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      {submitting === o._id ? "Submitting..." : "Submit Rating"}
                    </button>
                    {ratingErrors[o._id] && (
                      <p role="alert" className="mt-2 text-sm text-red-600">{ratingErrors[o._id]}</p>
                    )}
                  </div>
                )}

                {/* Already rated */}
                {o.rating?.ratedAt && (
                  <div className="px-4 py-3 bg-green-50 border-t border-gray-50">
                    <p className="text-sm text-gray-600">
                      You rated: ⭐ {o.rating.storeRating || "–"} (Store) • ⭐ {o.rating.deliveryRating || "–"} (Delivery)
                    </p>
                    {o.rating.comment && <p className="text-xs text-gray-500 mt-1">"{o.rating.comment}"</p>}
                  </div>
                )}
              </div>
            );
          })}
          {orders.length === 0 && !loading && !loadError && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg mb-4">No orders yet.</p>
              <button onClick={() => navigate("/")} className="bg-brand-600 text-white font-semibold rounded-xl px-6 py-3 hover:bg-brand-700 transition-colors">
                Start Shopping
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
