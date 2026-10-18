import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { useAuthStore } from "../store/authStore.js";

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accessToken = useAuthStore((s) => s.accessToken);
  const orderIds = orders.map((order) => order._id).join(",");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      api.get("/orders")
        .then((res) => {
          if (!cancelled) {
            setOrders(res.data.data.orders);
            setError("");
          }
        })
        .catch((requestError) => {
          if (!cancelled) {
            setOrders([]);
            setError(requestError.response?.data?.message || requestError.message || "Unable to load orders.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket(accessToken);
    orders.forEach((o) => socket.emit("order:join", o._id));
    return () => socket.disconnect();
  }, [accessToken, orderIds]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Orders</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={loading ? (
          <Text style={styles.empty}>Loading orders...</Text>
        ) : error ? null : (
          <Text style={styles.empty}>No orders yet.</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row", justifyContent: "space-between" },
  orderNumber: { fontWeight: "600" },
  status: { color: "#158a49", fontWeight: "600" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40 },
  error: { color: "#b91c1c", textAlign: "center", marginBottom: 12 },
});
