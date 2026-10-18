import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const PORTAL = import.meta.env.VITE_PORTAL || "customer";

export default function Login() {
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState("");
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/request", { identifier });
      setChannel(data.data.channel);
      setStep("otp");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to request an OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { identifier, code, name: name || undefined, portal: PORTAL });
      setSession({ accessToken: data.data.accessToken, user: data.data.user });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to verify your OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-brand-600 tracking-tight">MeiteiMart</h1>
          <p className="text-gray-500 mt-1 text-sm">Fresh groceries & essentials, delivered fast</p>
        </div>

        <div className="bg-white shadow-xl rounded-3xl p-8 border border-gray-100">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}

          {step === "identifier" ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sign in or Sign up</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or mobile number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? "Sending OTP..." : "Continue"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                By continuing, you agree to our Terms & Privacy Policy
              </p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-brand-50 flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code sent via {channel === "EMAIL" ? "email" : "SMS"} to
                </p>
                <p className="font-semibold text-sm mt-0.5">{identifier}</p>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="• • • • • •"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 tracking-[0.5em] text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (first time only)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
              <button type="button" onClick={() => setStep("identifier")} className="w-full text-sm text-gray-500 hover:text-brand-600 transition-colors">
                Change email/mobile
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
