"use client";

import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="login-btn"
    >
      <span className="btn-bg" />
      <span className="btn-text">Initialize Session</span>
      <svg className="btn-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 4L16 10L10 16M16 10H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
