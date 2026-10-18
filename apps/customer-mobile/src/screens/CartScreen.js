import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../lib/api.js";
import { useCartStore } from "../store/cartStore.js";
import { useAuthStore } from "../store/authStore.js";

const EMPTY_ADDRESS = { line1: "", city: "Imphal", state: "Manipur", postalCode: "795001" };

export default function CartScreen({ navigation }) {
  const items = useCartStore((state) => state.items);
  const decrement = useCartStore((state) => state.decrement);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const syncProducts = useCartStore((state) => state.syncProducts);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const storeId = items[0]?.store;
  const cartSignature = items.map((item) => `${item.product}:${item.quantity}`).sort().join(",");
  const [store, setStore] = useState(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [loading, setLoading] = useState(items.length > 0);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      setStore(null);
      setCatalogError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setCatalogError("");
    Promise.all([
      api.get(`/stores/${storeId}`),
      api.get("/products", { params: { store: storeId, limit: 100 } }),
    ])
      .then(([storeResponse, productResponse]) => {
        if (cancelled) return;
        const products = productResponse.data.data.products;
        const productsById = new Map(products.map((product) => [product._id, product]));
        const unavailableItem = items.find((item) => !productsById.has(item.product));
        const lowStockItem = items.find((item) => {
          const product = productsById.get(item.product);
          return product && item.quantity > product.stock;
        });
        setStore(storeResponse.data.data.store);
        syncProducts(products);
        if (unavailableItem) {
          setCatalogError(`${unavailableItem.name} is no longer available. Remove it to continue.`);
        } else if (lowStockItem) {
          setCatalogError(`There is not enough stock for ${lowStockItem.name}. Reduce its quantity to continue.`);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setStore(null);
          setCatalogError(requestError.response?.data?.message || requestError.message || "Unable to refresh the cart.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId, cartSignature, syncProducts]);

  const itemsTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const minOrderValue = store?.minOrderValue || 0;
  const belowMinimum = itemsTotal < minOrderValue;
  const freeDeliveryThreshold = store?.freeDeliveryThreshold || 0;
  const deliveryFee =
    freeDeliveryThreshold > 0 && itemsTotal >= freeDeliveryThreshold ? 0 : store?.deliveryFee || 0;
  const grandTotal = itemsTotal + deliveryFee;

  async function placeOrder() {
    if (!user) {
      setError("Please sign in before placing an order.");
      return;
    }
    setError("");
    setPlacing(true);
    try {
      await api.post("/orders", {
        store: storeId,
        items: items.map((item) => ({ product: item.product, quantity: item.quantity })),
        shippingAddress: address,
        paymentMethod: "COD",
      });
      clear();
      navigation.navigate("Orders");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to place the order.");
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Your cart is empty</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Browse products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>‹  Continue shopping</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{store?.name || "Your cart"}</Text>
      {loading ? <ActivityIndicator color="#158a49" style={styles.loading} /> : null}
      {catalogError ? <Text style={styles.error}>{catalogError}</Text> : null}
      {belowMinimum ? <Text style={styles.minimumNotice}>Add ₹{(minOrderValue - itemsTotal).toFixed(2)} more to meet this store&apos;s ₹{minOrderValue} minimum order.</Text> : null}

      {items.map((item) => (
        <View key={item.product} style={styles.itemCard}>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.muted}>{item.unit}</Text>
            <Text style={styles.price}>₹{item.price} each</Text>
          </View>
          <View style={styles.quantity}>
            <TouchableOpacity onPress={() => decrement(item.product)} style={styles.quantityButton}>
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => addItem({
                _id: item.product,
                name: item.name,
                price: item.price,
                unit: item.unit,
                images: [item.image],
                stock: item.stock,
              }, item.store)}
              style={styles.quantityButton}
              disabled={item.quantity >= item.stock}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => removeItem(item.product)}>
            <Text style={styles.remove}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Delivery address</Text>
      <TextInput
        style={styles.input}
        placeholder="House number, street, area"
        value={address.line1}
        onChangeText={(line1) => setAddress((current) => ({ ...current, line1 }))}
      />
      {["city", "state", "postalCode"].map((field) => (
        <TextInput
          key={field}
          style={styles.input}
          placeholder={field === "postalCode" ? "PIN code" : field[0].toUpperCase() + field.slice(1)}
          value={address[field]}
          onChangeText={(value) => setAddress((current) => ({ ...current, [field]: value }))}
        />
      ))}

      <View style={styles.bill}>
        <Text style={styles.sectionTitle}>Bill details</Text>
        <View style={styles.billRow}>
          <Text style={styles.muted}>Items</Text>
          <Text>₹{itemsTotal}</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={styles.muted}>Delivery</Text>
          <Text>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</Text>
        </View>
        <View style={[styles.billRow, styles.totalRow]}>
          <Text style={styles.total}>To pay</Text>
          <Text style={styles.total}>₹{grandTotal}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.orderButton, (placing || loading || Boolean(catalogError) || belowMinimum || !address.line1) && styles.disabled]}
        onPress={placeOrder}
        disabled={placing || loading || Boolean(catalogError) || belowMinimum || !address.line1}
      >
        <Text style={styles.orderButtonText}>{placing ? "Placing order..." : `Place order • ₹${grandTotal}`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  content: { paddingBottom: 32 },
  back: { color: "#158a49", fontWeight: "600", marginBottom: 12 },
  title: { color: "#17233d", fontSize: 22, fontWeight: "800", marginBottom: 14 },
  loading: { marginBottom: 12 },
  itemCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", padding: 14, marginBottom: 10 },
  itemDetails: { marginBottom: 10 },
  itemName: { color: "#17233d", fontSize: 15, fontWeight: "700" },
  muted: { color: "#64748b", fontSize: 13 },
  price: { color: "#158a49", fontSize: 14, fontWeight: "700", marginTop: 4 },
  quantity: { alignSelf: "flex-start", alignItems: "center", flexDirection: "row", borderWidth: 1, borderColor: "#158a49", borderRadius: 8 },
  quantityButton: { paddingHorizontal: 13, paddingVertical: 5 },
  quantityButtonText: { color: "#158a49", fontSize: 18, fontWeight: "700" },
  quantityText: { color: "#17233d", fontWeight: "700", minWidth: 25, textAlign: "center" },
  remove: { color: "#b91c1c", fontSize: 12, marginTop: 8 },
  sectionTitle: { color: "#17233d", fontSize: 17, fontWeight: "700", marginTop: 18, marginBottom: 10 },
  input: { backgroundColor: "#fff", borderColor: "#d1d5db", borderRadius: 9, borderWidth: 1, marginBottom: 9, padding: 12 },
  bill: { backgroundColor: "#fff", borderColor: "#e5e7eb", borderRadius: 12, borderWidth: 1, marginTop: 6, padding: 14 },
  billRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalRow: { borderTopColor: "#e5e7eb", borderTopWidth: 1, marginTop: 7, paddingTop: 12 },
  total: { color: "#17233d", fontSize: 16, fontWeight: "800" },
  orderButton: { alignItems: "center", backgroundColor: "#158a49", borderRadius: 11, marginTop: 14, padding: 15 },
  orderButtonText: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  secondaryButton: { backgroundColor: "#158a49", borderRadius: 10, marginTop: 12, padding: 14 },
  secondaryButtonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  error: { backgroundColor: "#fef2f2", borderRadius: 9, color: "#b91c1c", marginBottom: 10, padding: 10 },
  minimumNotice: { backgroundColor: "#fffbeb", borderRadius: 9, color: "#92400e", marginBottom: 10, padding: 10 },
});
