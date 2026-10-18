import { io } from "socket.io-client";
import { API_URL } from "./api.js";
import { useAuthStore } from "../store/authStore.js";

let socket = null;

export function getSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || API_URL, { auth: { token }, autoConnect: true });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
