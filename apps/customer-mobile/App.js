import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "./src/store/authStore.js";
import LoginScreen from "./src/screens/LoginScreen.js";
import HomeScreen from "./src/screens/HomeScreen.js";
import OrdersScreen from "./src/screens/OrdersScreen.js";
import CartScreen from "./src/screens/CartScreen.js";

const Stack = createNativeStackNavigator();

export default function App() {
  const { accessToken, hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (!hydrated) return null;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {accessToken ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: true }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
