import Link from "next/link";
import type { Metadata } from "next";
import "./landing.css";

export const metadata: Metadata = {
  title: "Short-App - AI Video Generation Platform",
  description: "AI-Powered Video Generation Platform for automated content creation",
};

export default function LandingPage() {
  return (
    <main className="landing-container">
      {/* Atmospheric background layers */}
      <div className="bg-layers">
        <div className="grain-overlay" />
        <div className="scan-lines" />
        <div className="gradient-mesh" />
      </div>

      {/* Main content - centered asymmetrically */}
      <div className="content-wrapper">
        {/* Brand mark - top left */}
        <div className="brand-mark">
          <h1 className="brand-text">
            <span className="glitch" data-text="SHORT">SHORT</span>
            <span className="separator">×</span>
            <span className="brand-sub">APP</span>
          </h1>
          <p className="tagline">AI-Powered Video Generation Platform</p>
        </div>

        {/* Login card - center, slightly offset */}
        <div className="login-card">
          <div className="card-header">
            <h2>Access Terminal</h2>
            <div className="status-indicator">
              <span className="status-dot" />
              <span className="status-text">ONLINE</span>
            </div>
          </div>

          <div className="card-body">
            <Link href="/dashboard" className="login-btn">
              <span className="btn-bg" />
              <span className="btn-text">Initialize Session</span>
              <svg className="btn-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4L16 10L10 16M16 10H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <div className="divider">
              <span>SECURE CONNECTION</span>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Encryption</span>
                <span className="info-value">AES-256</span>
              </div>
              <div className="info-item">
                <span className="info-label">Protocol</span>
                <span className="info-value">OAuth 2.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating stats - decorative */}
        <div className="stats-float stats-1">
          <div className="stat-value">99.8%</div>
          <div className="stat-label">Uptime</div>
        </div>

        <div className="stats-float stats-2">
          <div className="stat-value">247ms</div>
          <div className="stat-label">Avg Response</div>
        </div>
      </div>

      {/* Footer - legal links */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <Link href="/privacy" className="footer-link">
              Privacy Policy
            </Link>
            <span className="footer-divider">•</span>
            <Link href="/terms" className="footer-link">
              Terms of Service
            </Link>
          </div>
          <div className="footer-meta">
            <span className="footer-year">2026</span>
            <span className="footer-version">v2.1.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
