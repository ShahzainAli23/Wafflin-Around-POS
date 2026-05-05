"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("worker@wafflin.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function login() {
    if (isLoggingIn) return;

    setError("");
    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Wrong email or password");
      setIsLoggingIn(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setError("Profile not found");
      setIsLoggingIn(false);
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/pos");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    login();
  }

  return (
    <main className="min-h-screen bg-[#f7eedf] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[#ead8c2]">
        <div className="bg-[#d81b72] text-white p-8 lg:p-12 flex flex-col justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] opacity-80">
              Wafflin' Around
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold mt-4 leading-tight">
              POS
              <br />
              Login
            </h1>
          </div>

          <div className="mt-10 bg-white/10 rounded-3xl p-5 backdrop-blur">
            <p className="text-sm opacity-80">Roles</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 p-4">
                <p className="font-bold">Worker</p>
                <p className="text-sm opacity-80 mt-1">Take orders</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4">
                <p className="font-bold">Admin</p>
                <p className="text-sm opacity-80 mt-1">See reports</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#fff9f1] p-8 lg:p-12 flex items-center">
          <form onSubmit={handleSubmit} className="w-full">
            <h2 className="text-3xl font-bold text-[#241814]">Welcome back</h2>
            <p className="text-[#7b5b4f] mt-2">Login to continue</p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#241814] mb-2">
                  Email
                </label>
                <input
                  className="w-full rounded-2xl border border-[#ead8c2] bg-white px-4 py-3 text-[#241814] outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  disabled={isLoggingIn}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#241814] mb-2">
                  Password
                </label>
                <input
                  className="w-full rounded-2xl border border-[#ead8c2] bg-white px-4 py-3 text-[#241814] outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  disabled={isLoggingIn}
                />
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full rounded-2xl py-3 font-bold shadow-[0_10px_30px_rgba(216,27,114,0.35)] ${
                  isLoggingIn
                    ? "bg-[#9d8a82] text-white cursor-not-allowed"
                    : "bg-[#d81b72] text-white"
                }`}
              >
                {isLoggingIn ? "Logging in..." : "Login"}
              </button>

              {isLoggingIn && (
                <div className="flex items-center justify-center gap-2 text-[#7b5b4f]">
                  <span className="h-3 w-3 rounded-full bg-[#d81b72] animate-pulse" />
                  <span className="text-sm font-bold">Please wait</span>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}