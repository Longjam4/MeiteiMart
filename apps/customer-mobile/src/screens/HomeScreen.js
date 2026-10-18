import { useEffect, useState } from "react";
import { Alert, View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { useCartStore } from "../store/cartStore.js";

export default function HomeScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState("");
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const cart = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const decrement = useCartStore((s) => s.decrement);
  const navigation = useNavigation();

  useEffect(() => {
    let cancelled = false;
    api.get("/products", { params: { limit: 100 } })
      .then((res) => {
        if (!cancelled) setProducts(res.data.data.products);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setProducts([]);
          setError(requestError.response?.data?.message || requestError.message || "Unable to load products.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get("/services")
      .then((res) => {
        if (!cancelled) setServices(res.data.data.services);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setServices([]);
          setServiceError(requestError.response?.data?.message || requestError.message || "Unable to load services.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addProduct(product) {
    const storeId = typeof product.store === "object" ? product.store?._id : product.store;
    if (!storeId) {
      setError("This product is not linked to a store and cannot be ordered.");
      return;
    }
    if (cart.length > 0 && cart[0].store !== storeId) {
      Alert.alert(
        "Different store",
        "Your cart can only contain products from one store. Replace the current cart?",
        [
          { text: "Keep cart", style: "cancel" },
          {
            text: "Replace cart",
            style: "destructive",
            onPress: () => {
              useCartStore.getState().clear();
              addItem(product, storeId);
            },
          },
        ]
      );
      return;
    }
    addItem(product, storeId);
  }

  function handleLogout() {
    useCartStore.getState().clear();
    logout();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi, {user?.name?.split(" ")[0] || "there"} 👋</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate("Cart")}>
            <Text style={styles.cartLink}>Cart ({cart.reduce((total, item) => total + item.quantity, 0)})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logout}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.productsHeading}>Shop products for delivery</Text>
            {loading ? <Text style={styles.empty}>Loading products...</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.servicesSection}>
            <Text style={styles.eyebrow}>ALL-IN-ONE ONLINE SERVICES PLATFORM</Text>
            <Text style={styles.servicesTitle}>More than food delivery</Text>
            <Text style={styles.servicesDescription}>
              One app for everyday delivery, goods transport, event rentals and household help.
            </Text>
            {serviceError ? <Text style={styles.error}>{serviceError}</Text> : null}
            {!serviceError && services.length === 0 ? <Text style={styles.empty}>No services are available right now.</Text> : null}
            {services.map((service) => (
              <View key={service._id} style={styles.serviceCard}>
                {service.imageUrl ? (
                  <Image source={{ uri: service.imageUrl }} style={styles.serviceImage} />
                ) : (
                <View style={[styles.serviceNumber, { backgroundColor: service.accent }]}>
                  <Text style={styles.serviceNumberText}>{service.number}</Text>
                </View>
                )}
                <View style={styles.serviceCopy}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                  <Text style={[styles.serviceBooking, { color: service.accent }]}>
                    Booking: {service.booking}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={styles.sharedPlatform}>
              Customer app • provider app • payments • bookings • tracking • support
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.productImage} /> : null}
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.unit}>{item.store?.name || "Nearby store"}{item.unit ? ` • ${item.unit}` : ""}</Text>
              {item.category?.name ? <Text style={styles.unit}>{item.category.name}</Text> : null}
              <Text style={styles.price}>₹{item.price}</Text>
              {(() => {
                const quantity = cart.find((cartItem) => cartItem.product === item._id)?.quantity || 0;
                return quantity === 0 ? (
                  <TouchableOpacity
                    style={[styles.addButton, item.stock <= 0 && styles.disabled]}
                    onPress={() => addProduct(item)}
                    disabled={item.stock <= 0}
                  >
                    <Text style={styles.addButtonText}>{item.stock <= 0 ? "OUT OF STOCK" : "ADD"}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.quantity}>
                    <TouchableOpacity onPress={() => decrement(item._id)} style={styles.quantityButton}>
                      <Text style={styles.quantityButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity onPress={() => addProduct(item)} style={styles.quantityButton} disabled={quantity >= item.stock}>
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>
          </View>
        )}
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No products are available yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  logout: { color: "#dc2626" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  cartLink: { color: "#158a49", fontWeight: "700" },
  listHeader: { marginBottom: 8 },
  servicesSection: { marginBottom: 18 },
  eyebrow: { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  servicesTitle: { color: "#17233d", fontSize: 24, fontWeight: "800", marginTop: 6 },
  servicesDescription: { color: "#64748b", fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 14 },
  serviceCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row", alignItems: "center" },
  serviceNumber: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: 12, borderRadius: 6 },
  serviceImage: { width: 48, height: 48, marginRight: 12, borderRadius: 6 },
  serviceNumberText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  serviceCopy: { flex: 1 },
  serviceTitle: { color: "#17233d", fontSize: 14, fontWeight: "700" },
  serviceDescription: { color: "#64748b", fontSize: 11, lineHeight: 16, marginTop: 4 },
  serviceBooking: { fontSize: 11, fontWeight: "700", marginTop: 5 },
  sharedPlatform: { backgroundColor: "#e2e8f0", borderRadius: 8, color: "#334155", fontSize: 11, fontWeight: "600", lineHeight: 17, padding: 10, textAlign: "center" },
  productsHeading: { color: "#111827", fontSize: 19, fontWeight: "800", marginTop: 4, marginBottom: 10 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  productName: { fontWeight: "600" },
  unit: { color: "#6b7280", fontSize: 12 },
  price: { marginTop: 6, fontWeight: "700", color: "#158a49" },
  error: { color: "#b91c1c", fontSize: 13, marginBottom: 8 },
  productImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: "#f3f4f6", marginRight: 12 },
  productDetails: { flex: 1, justifyContent: "center" },
  addButton: { alignSelf: "flex-start", borderColor: "#158a49", borderRadius: 7, borderWidth: 1, marginTop: 9, paddingHorizontal: 16, paddingVertical: 5 },
  addButtonText: { color: "#158a49", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  quantity: { alignSelf: "flex-start", alignItems: "center", flexDirection: "row", borderColor: "#158a49", borderRadius: 7, borderWidth: 1, marginTop: 9 },
  quantityButton: { paddingHorizontal: 10, paddingVertical: 2 },
  quantityButtonText: { color: "#158a49", fontSize: 17, fontWeight: "700" },
  quantityText: { color: "#17233d", fontWeight: "700", minWidth: 20, textAlign: "center" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40 },
});
