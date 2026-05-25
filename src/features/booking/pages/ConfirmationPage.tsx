import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../../convex/api";
// @ts-ignore
import type { Id } from "../../../convex/dataModel";
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; note: string }> = {
  pending: {
    label: "Pending Review",
    color: "#f59e0b",
    icon: "⏳",
    note: "The receptionist will review your booking shortly.",
  },
  approved: {
    label: "Approved",
    color: "#10b981",
    icon: "✅",
    note: "Your visit has been approved! Please arrive on time.",
  },
  rejected: {
    label: "Declined",
    color: "#ef4444",
    icon: "❌",
    note: "Unfortunately your booking was declined. Please contact the front desk.",
  },
  checked_in: {
    label: "Checked In",
    color: "#6366f1",
    icon: "🏢",
    note: "You are checked in. Welcome!",
  },
  checked_out: {
    label: "Checked Out",
    color: "#6b7280",
    icon: "👋",
    note: "Your visit is complete. Thanks for coming!",
  },
  cancelled: {
    label: "Cancelled",
    color: "#6b7280",
    icon: "🚫",
    note: "This booking has been cancelled.",
  },
  no_show: {
    label: "No Show",
    color: "#ef4444",
    icon: "⚠️",
    note: "This visit was marked as a no-show.",
  },
};

export function ConfirmationPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Live polling — re-fetches automatically when Convex data changes
  const booking = useQuery(
    api.scheduling.getById,
    state?.bookingId ? { visitId: state.bookingId as Id<"scheduledVisits"> } : "skip"
  );

  const currentStatus = booking?.status ?? "pending";
  const statusCfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.pending;

  return (
    <div className="bk">
      <div className="bk-header">
        <div className="bk-logo">
          <div className="bk-logo-mark">P</div>
          <div>
            <div className="bk-logo-name">Porta</div>
            <div className="bk-logo-sub">Visit booking</div>
          </div>
        </div>
      </div>

      <div className="bk-body">
        <div className="bk-confirm-card">
          {/* Live status badge */}
          <div
            className="bk-confirm-status-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "999px",
              background: `${statusCfg.color}18`,
              color: statusCfg.color,
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "12px",
              border: `1px solid ${statusCfg.color}40`,
            }}
          >
            <span>{statusCfg.icon}</span>
            <span>{statusCfg.label}</span>
            {/* Pulse dot while pending */}
            {currentStatus === "pending" && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusCfg.color,
                  animation: "pulse 1.5s infinite",
                  display: "inline-block",
                }}
              />
            )}
          </div>

          <div className="bk-confirm-icon">
            {currentStatus === "pending" ? "📋" : statusCfg.icon}
          </div>

          <h1 className="bk-confirm-title">
            {currentStatus === "pending" ? "Booking received!" : statusCfg.label}
          </h1>

          <p className="bk-confirm-sub">
            Thanks{" "}
            {state?.name ? <strong>{state.name}</strong> : "for your booking"}.{" "}
            {statusCfg.note}
          </p>

          <div className="bk-confirm-details">
            {state?.date && (
              <div className="bk-confirm-row">
                <span className="bk-confirm-row-label">Date</span>
                <span className="bk-confirm-row-value">
                  {new Date(state.date).toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {state?.time && (
              <div className="bk-confirm-row">
                <span className="bk-confirm-row-label">Time</span>
                <span className="bk-confirm-row-value">
                  {new Date(`2000-01-01T${state.time}`).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {state?.host && (
              <div className="bk-confirm-row">
                <span className="bk-confirm-row-label">Host</span>
                <span className="bk-confirm-row-value">{state.host}</span>
              </div>
            )}
            {/* Show live status row when booking is loaded */}
            {booking && (
              <div className="bk-confirm-row">
                <span className="bk-confirm-row-label">Status</span>
                <span
                  className="bk-confirm-row-value"
                  style={{ color: statusCfg.color, fontWeight: 600 }}
                >
                  {statusCfg.label}
                </span>
              </div>
            )}
          </div>

          <div className="bk-confirm-note">
            {currentStatus === "pending"
              ? "This page updates automatically — no need to refresh."
              : statusCfg.note}
          </div>

          <button className="bk-next-btn" onClick={() => navigate("/")}>
            Book another visit
          </button>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
