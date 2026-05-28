import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import { api } from "../../convex/api";
// @ts-ignore
import type { Id } from "../../convex/dataModel";
import { useTheme } from "../../../App";

type Step = "details" | "datetime" | "review";

const PURPOSES = ["Meeting", "Interview", "Delivery", "Consultation", "Site visit", "Other"];

function StepDot({ n, current, done }: { n: number; current: number; done: boolean }) {
  const active = n === current;
  const bg     = done ? "#45ba50" : active ? "#45ba50" : "transparent";
  const border = done || active ? "#45ba50" : "var(--border)";
  const color  = done || active ? "#fff" : "var(--subtle)";
  return (
    <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:bg, border:`2px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color, transition:"all 0.2s", flexShrink:0 }}>
      {done ? "✓" : n}
    </div>
  );
}

/** Convert "HH:MM" -> minutes from midnight */
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function BookingPage() {
  const navigate       = useNavigate();
  const { dark, toggle } = useTheme();

  // Live data - Convex keeps these updated automatically
  const staff        = useQuery(api.scheduling.listStaffPublic);
  const allBlocked   = useQuery(api.scheduling.listAllBlockedSlots);
  const allVisits    = useQuery(api.scheduling.listApprovedVisits);

  const bookVisit    = useMutation(api.scheduling.publicBook);

  const [step, setStep]      = useState<Step>("details");
  const [submitting, setSub] = useState(false);
  const [error, setError]    = useState("");

  const [form, setForm] = useState({
    visitorName: "", visitorEmail: "", visitorPhone: "",
    visitorCompany: "", purpose: "", hostStaffId: "",
    scheduledDate: new Date().toISOString().split("T")[0], scheduledTime: (() => { const n = new Date(); n.setMinutes(n.getMinutes() >= 30 ? 30 : 0, 0, 0); return n.toTimeString().slice(0, 5); })(), notes: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const today        = new Date().toISOString().split("T")[0];
  const selectedHost = staff?.find((s: any) => s._id === form.hostStaffId);

  /**
   * Real-time conflict detection.
   * A slot is BLOCKED if, for the selected host+date+time:
   *  1. There is a blockedSlot row covering that time range, OR
   *  2. There is an existing approved/checked_in visit at that time (+/-30 min window)
   */
  const conflictReason = useMemo(() => {
    if (!form.scheduledDate || !form.scheduledTime || !form.hostStaffId) return null;

    const pickedMins = toMins(form.scheduledTime);

    const blocked = (allBlocked ?? []).find((b: any) => {
      if (b.staffId !== form.hostStaffId) return false;
      if (b.date !== form.scheduledDate)  return false;
      const start = toMins(b.startTimeStr);
      const end   = toMins(b.endTimeStr);
      return pickedMins >= start && pickedMins < end;
    });
    if (blocked) return blocked.reason ? `Blocked: ${blocked.reason}` : "This slot is blocked";

    const pickedTs = new Date(`${form.scheduledDate}T${form.scheduledTime}`).getTime();
    const clash = (allVisits ?? []).find((v: any) => {
      if (v.hostStaffId !== form.hostStaffId) return false;
      return Math.abs(v.scheduledDate - pickedTs) < 30 * 60 * 1000;
    });
    if (clash) return `${selectedHost?.name ?? "This person"} already has a visit around this time`;

    return null;
  }, [form.scheduledDate, form.scheduledTime, form.hostStaffId, allBlocked, allVisits, selectedHost]);

  const handleSubmit = async () => {
    if (!form.visitorName || !form.scheduledDate || !form.scheduledTime) return;
    if (conflictReason) { setError(conflictReason); return; }
    setSub(true); setError("");
    try {
      const dt = new Date(`${form.scheduledDate}T${form.scheduledTime}`).getTime();
      const visitId = await bookVisit({
        visitorName:    form.visitorName,
        visitorEmail:   form.visitorEmail   || undefined,
        visitorPhone:   form.visitorPhone   || undefined,
        visitorCompany: form.visitorCompany || undefined,
        purpose:        form.purpose        || undefined,
        hostStaffId:    (form.hostStaffId   || undefined) as Id<"staff"> | undefined,
        scheduledDate:  dt,
        notes:          form.notes          || undefined,
      });
      navigate("/confirmed", {
        state: { bookingId: visitId,
          name: form.visitorName,
          date: form.scheduledDate,
          time: form.scheduledTime,
          host: selectedHost?.name,
        },
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setSub(false); }
  };

  const canNext1 = !!form.visitorName;
  const canNext2 = !!form.scheduledDate && !!form.scheduledTime && !conflictReason;
  const STEPS    = ["Your details", "Date & time", "Review & confirm"];
  const stepIdx  = step === "details" ? 0 : step === "datetime" ? 1 : 2;

  return (
    <div className="bk">
      <div className="bk-header">
        <div className="bk-logo"><img src="/Porta.png" alt="Porta" style={{height:"32px",width:"auto"}}/></div>
        <div style={{marginLeft:"auto"}}><button className="bk-theme-btn" onClick={toggle}>
          {dark ? "Light mode" : "Dark mode"}</button></div>
      </div>
      <div className="bk-body">
        <div className="bk-hero">
          <h1 className="bk-hero-title">Book a visit</h1>
          <p className="bk-hero-sub">Fill in your details and we will confirm your appointment.</p>
        </div>

        <div className="bk-stepper">
          {STEPS.map((label, i) => (
            <div key={i} className="bk-step">
              <StepDot n={i + 1} current={stepIdx + 1} done={i < stepIdx} />
              <span className={"bk-step-label" + (i === stepIdx ? " bk-step-label--on" : "")}>{label}</span>
              {i < STEPS.length - 1 && <div className="bk-step-line" />}
            </div>
          ))}
        </div>

        <div className="bk-card">

          {step === "details" && (
            <div className="bk-step-body">
              <div className="bk-step-title">Tell us about yourself</div>
              <div className="bk-fields">
                <div className="bk-field bk-field--full">
                  <label className="bk-label">Full name <span className="bk-req">*</span></label>
                  <input className="bk-input" placeholder="Jane Mensah" value={form.visitorName}
                    onChange={e => set("visitorName", e.target.value)} />
                </div>
                <div className="bk-field">
                  <label className="bk-label">Email address</label>
                  <input className="bk-input" type="email" placeholder="jane@company.com" value={form.visitorEmail}
                    onChange={e => set("visitorEmail", e.target.value)} />
                </div>
                <div className="bk-field">
                  <label className="bk-label">Phone number</label>
                  <input className="bk-input" type="tel" placeholder="+233 55 000 0000" value={form.visitorPhone}
                    onChange={e => set("visitorPhone", e.target.value)} />
                </div>
                <div className="bk-field">
                  <label className="bk-label">Company / Organisation</label>
                  <input className="bk-input" placeholder="Acme Corp" value={form.visitorCompany}
                    onChange={e => set("visitorCompany", e.target.value)} />
                </div>
                <div className="bk-field">
                  <label className="bk-label">Purpose of visit</label>
                  <select className="bk-input bk-select" value={form.purpose}
                    onChange={e => set("purpose", e.target.value)}>
                    <option value="">Select a purpose</option>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="bk-field bk-field--full">
                  <label className="bk-label">Who are you visiting?</label>
                  <select className="bk-input bk-select" value={form.hostStaffId}
                    onChange={e => set("hostStaffId", e.target.value)}>
                    <option value="">Select a person</option>
                    {(staff ?? []).map((s: any) => (
                      <option key={s._id} value={s._id}>
                        {s.name}{s.department ? " - " + s.department : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bk-card-footer">
                <div />
                <button className="bk-next-btn" disabled={!canNext1} onClick={() => setStep("datetime")}>
                  Next: Date and Time
                </button>
              </div>
            </div>
          )}

          {step === "datetime" && (
            <div className="bk-step-body">
              <div className="bk-step-title">Appointment Schedule</div>
              <div className="bk-fields">
                <div className="bk-field">
                  <label className="bk-label">Date <span className="bk-req">*</span></label>
                  <input className="bk-input" type="date" min={today} value={form.scheduledDate}
                    onChange={e => set("scheduledDate", e.target.value)} />
                </div>
                <div className="bk-field">
                  <label className="bk-label">Time <span className="bk-req">*</span></label>
                  <input className="bk-input" type="time" value={form.scheduledTime}
                    onChange={e => set("scheduledTime", e.target.value)} />
                </div>

                {conflictReason && form.scheduledDate && form.scheduledTime && (
                  <div className="bk-field bk-field--full">
                    <div className="bk-conflict-warning">
                      ⚠️ {conflictReason}. Please choose a different time.
                    </div>
                  </div>
                )}

                {form.hostStaffId && !conflictReason && form.scheduledDate && form.scheduledTime && (
                  <div className="bk-field bk-field--full">
                    <div className="bk-avail-ok">
                      ✓ {selectedHost?.name ?? "This person"} appears available at this time
                    </div>
                  </div>
                )}

                <div className="bk-field bk-field--full">
                  <label className="bk-label">Additional notes</label>
                  <textarea className="bk-input bk-textarea" rows={3}
                    placeholder="Anything we should know before your visit..."
                    value={form.notes} onChange={e => set("notes", e.target.value)} />
                </div>
              </div>
              <div className="bk-card-footer">
                <button className="bk-back-btn" onClick={() => setStep("details")}>Back</button>
                <button className="bk-next-btn" disabled={!canNext2} onClick={() => setStep("review")}>
                  Review booking
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="bk-step-body">
              <div className="bk-step-title">Review your booking</div>
              <div className="bk-review-grid">
                {[
                  { label: "Name",    value: form.visitorName },
                  { label: "Email",   value: form.visitorEmail    || "-" },
                  { label: "Phone",   value: form.visitorPhone    || "-" },
                  { label: "Company", value: form.visitorCompany  || "-" },
                  { label: "Purpose", value: form.purpose         || "-" },
                  { label: "Host",    value: selectedHost?.name   || "-" },
                  { label: "Date",    value: form.scheduledDate
                    ? new Date(form.scheduledDate).toLocaleDateString([], { weekday:"long", year:"numeric", month:"long", day:"numeric" })
                    : "-" },
                  { label: "Time",    value: form.scheduledTime
                    ? new Date("2000-01-01T" + form.scheduledTime).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
                    : "-" },
                  { label: "Notes",   value: form.notes           || "-" },
                ].map(({ label, value }) => (
                  <div key={label} className="bk-review-row">
                    <span className="bk-review-label">{label}</span>
                    <span className="bk-review-value">{value}</span>
                  </div>
                ))}
              </div>
              {error && <div className="bk-error">{error}</div>}
              <div className="bk-card-footer">
                <button className="bk-back-btn" onClick={() => setStep("datetime")}>Back</button>
                <button className="bk-submit-btn" disabled={submitting || !!conflictReason} onClick={handleSubmit}>
                  {submitting ? "Submitting..." : "Confirm booking"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="bk-footer-note">
          Your booking will be reviewed by our team. You will receive a confirmation once accepted.
        </p>
      </div>
    </div>
  );
}