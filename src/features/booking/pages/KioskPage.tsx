// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/api";

// ── idle reset after 2 minutes ────────────────────────────────────────────────
const IDLE_MS = 2 * 60 * 1000;

type Screen =
  | "landing"
  | "checkin_search"
  | "checkin_result"
  | "checkin_done"
  | "walkin_details"
  | "walkin_datetime"
  | "walkin_review"
  | "walkin_done"
  | "checkout_search"
  | "checkout_confirm"
  | "checkout_done";

export function KioskPage() {
  // Swap to kiosk manifest so PWA installs with correct start_url
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link ? link.getAttribute('href') : '';
    if (link) link.setAttribute('href', '/manifest-kiosk.json');
    return () => { if (link && prev) link.setAttribute('href', prev); };
  }, []);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const { slug } = useParams<{ slug?: string }>();

  const orgConfig  = useQuery(api.orgSettings.getPublicConfig, slug ? { slug } : {});
  const allVisits  = useQuery(api.scheduling.listApprovedVisits);
  const bookVisit  = useMutation(api.scheduling.publicBook);
  const checkIn      = useMutation(api.scheduling.markCheckedIn);
  const checkOut     = useMutation(api.scheduling.markCompleted);
  const checkOutVisitor = useMutation(api.visitors.checkOut);

  const orgName      = orgConfig?.branding?.appName ?? orgConfig?.org?.name ?? "Porta";
  const logoUrl      = orgConfig?.branding?.logoUrl ?? null;
  const primaryColor = orgConfig?.branding?.primaryColor ?? "#3fb950";
  const staff        = orgConfig?.staff ?? [];
  const purposes     = orgConfig?.rules?.allowedPurposes ?? ["Meeting","Interview","Delivery","Consultation","Site visit","Other"];
  const durations    = orgConfig?.rules?.allowedDurations  ?? [30,60,90,120];
  const defaultDur   = orgConfig?.rules?.defaultDuration   ?? 60;
  const walkInEnabled   = orgConfig?.rules?.walkInEnabled  ?? true;
  const emailRequired   = orgConfig?.rules?.emailRequired   ?? false;
  const phoneRequired   = orgConfig?.rules?.phoneRequired   ?? false;
  const companyRequired = orgConfig?.rules?.companyRequired ?? false;
  const purposeRequired = orgConfig?.rules?.purposeRequired ?? false;

  const [screen, setScreen]       = useState<Screen>("landing");
  const [searchQ, setSearchQ]     = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [checkInDone, setCheckInDone]     = useState(false);
  const [submitting, setSub]      = useState(false);
  const [error, setError]         = useState("");
  const [checkoutQ, setCheckoutQ]           = useState("");
  const [checkoutResults, setCheckoutResults] = useState<any[]>([]);
  const [selectedCheckout, setSelectedCheckout] = useState<any>(null);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    visitorName:"", visitorEmail:"", visitorPhone:"",
    visitorCompany:"", purpose:"", hostStaffId:"",
    scheduledDate: today,
    scheduledTime: new Date().toTimeString().slice(0,5),
    duration: defaultDur, notes:"",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── checkout search ───────────────────────────────────────────────────────
  const handleCheckoutSearch = () => {
    if (!checkoutQ.trim()) return;
    const q = checkoutQ.toLowerCase();
    const results = (allVisits ?? []).filter((v: any) => {
      const nameMatch  = (v.visitorName  ?? "").toLowerCase().includes(q);
      const phoneMatch = (v.visitorPhone ?? "").toLowerCase().includes(q);
      const emailMatch = (v.visitorEmail ?? "").toLowerCase().includes(q);
      const active = ["checked_in", "in_meeting", "approved", "accepted"].includes(v.status);
      return (nameMatch || phoneMatch || emailMatch) && active;
    });
    setCheckoutResults(results);
  };

  // ── checkout confirm ──────────────────────────────────────────────────────
  const handleCheckout = async (visit: any) => {
    setSub(true); setError("");
    try {
      await checkOut({ visitId: visit._id });
      setScreen("checkout_done");
      setTimeout(resetToLanding, 8000);
    } catch { setError("Checkout failed. Please see the receptionist."); }
    finally { setSub(false); }
  };

  // ── idle reset ────────────────────────────────────────────────────────────
  const resetToLanding = useCallback(() => {
    setScreen("landing");
    setSearchQ(""); setSearchResults([]); setSelectedVisit(null);
    setCheckInDone(false); setError(""); setSub(false);
    setCheckoutQ(""); setCheckoutResults([]); setSelectedCheckout(null);
    setForm({ visitorName:"", visitorEmail:"", visitorPhone:"", visitorCompany:"", purpose:"", hostStaffId:"", scheduledDate: today, scheduledTime: new Date().toTimeString().slice(0,5), duration: defaultDur, notes:"" });
  }, [today]);

  useEffect(() => {
    if (screen === "landing") return;
    const t = setTimeout(resetToLanding, IDLE_MS);
    const reset = () => { clearTimeout(t); };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, [screen, resetToLanding]);

  // ── search existing bookings ───────────────────────────────────────────────
  const handleSearch = () => {
    if (!searchQ.trim()) return;
    const q = searchQ.toLowerCase();
    const today_start = new Date(today).getTime();
    const results = (allVisits ?? []).filter((v: any) => {
      const nameMatch  = (v.visitorName  ?? "").toLowerCase().includes(q);
      const emailMatch = (v.visitorEmail ?? "").toLowerCase().includes(q);
      const isToday    = v.scheduledDate >= today_start;
      const isPending  = ["pending","approved","accepted"].includes(v.status);
      return (nameMatch || emailMatch) && isToday && isPending;
    });
    setSearchResults(results);
  };

  // ── self check-in ──────────────────────────────────────────────────────────
  const handleCheckIn = async (visit: any) => {
    setSub(true);
    try {
      await checkIn({ visitId: visit._id });
      setCheckInDone(true);
      setScreen("checkin_done");
      setTimeout(resetToLanding, 8000);
    } catch { setError("Check-in failed. Please see the receptionist."); }
    finally { setSub(false); }
  };

  // ── walk-in submit ─────────────────────────────────────────────────────────
  const handleWalkIn = async () => {
    if (!form.visitorName) return;
    setSub(true); setError("");
    try {
      const dt = new Date(`${form.scheduledDate}T${form.scheduledTime}`).getTime();
      await bookVisit({
        visitorName:    form.visitorName,
        visitorEmail:   form.visitorEmail   || undefined,
        visitorPhone:   form.visitorPhone   || undefined,
        visitorCompany: form.visitorCompany || undefined,
        purpose:        form.purpose        || undefined,
        hostStaffId:    (form.hostStaffId   || undefined) as any,
        scheduledDate:  dt,
        duration:       form.duration,
        notes:          form.notes          || undefined,
        orgSlug:        slug ?? undefined,
      });
      setScreen("walkin_done");
      setTimeout(resetToLanding, 10000);
    } catch { setError("Something went wrong. Please try again or see the receptionist."); }
    finally { setSub(false); }
  };

  const selectedHost = staff.find((s: any) => s._id === form.hostStaffId);

  if (orgConfig === undefined) return (
    <div style={styles.fullCenter}>
      <div style={styles.loading}>Loading...</div>
    </div>
  );

  if (slug && orgConfig === null) return (
    <div style={styles.fullCenter}>
      <div style={{color:"#e6edf3",fontWeight:700,fontSize:"1.2rem"}}>Organisation not found</div>
    </div>
  );

  return (
    <div style={{...styles.root, background: `linear-gradient(135deg, #0d1117 0%, #161b22 100%)`}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }
        body { background: #0d1117; }
        .kiosk-btn-primary {
          background: ${primaryColor};
          color: #fff;
          border: none;
          border-radius: 16px;
          padding: 20px 40px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          width: 100%;
        }
        .kiosk-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .kiosk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .kiosk-btn-secondary {
          background: rgba(255,255,255,0.06);
          color: #e6edf3;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 20px 40px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          width: 100%;
        }
        .kiosk-btn-secondary:hover { background: rgba(255,255,255,0.1); transform: translateY(-1px); }
        .kiosk-input {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          font-size: 1rem;
          font-family: inherit;
          color: #e6edf3;
          outline: none;
          transition: border-color 0.15s;
        }
        .kiosk-input:focus { border-color: ${primaryColor}; }
        .kiosk-input::placeholder { color: #8b949e; }
        .kiosk-select {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          font-size: 1rem;
          font-family: inherit;
          color: #e6edf3;
          outline: none;
          cursor: pointer;
        }
        .kiosk-select option { background: #161b22; color: #e6edf3; }
        .kiosk-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 20px 24px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .kiosk-card:hover { background: rgba(255,255,255,0.08); border-color: ${primaryColor}; }
        .kiosk-back {
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          padding: 10px 20px;
          color: #8b949e;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .kiosk-back:hover { color: #e6edf3; border-color: rgba(255,255,255,0.3); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .kiosk-fade { animation: fadeIn 0.3s ease; }
        @keyframes checkmark { from { transform: scale(0); } to { transform: scale(1); } }
        .kiosk-check { animation: checkmark 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {logoUrl
            ? <img src={logoUrl} alt={orgName} style={{height:"36px",width:"auto",borderRadius:8}} />
            : <div style={{...styles.brandMark, background: primaryColor}}>{orgName[0]?.toUpperCase()}</div>
          }
          <span style={styles.orgName}>{orgName}</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.clock}>{now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
          <div style={styles.date}>{now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</div>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.main}>

        {/* ── LANDING ──────────────────────────────────────────────────── */}
        {screen === "landing" && (
          <div className="kiosk-fade" style={styles.center}>
            
            <h1 style={styles.welcomeTitle}>Welcome to {orgName}</h1>
            <p style={styles.welcomeSub}>How can we help you today?</p>
            <div style={styles.landingBtns}>
              <button className="kiosk-btn-secondary" style={{fontSize:"1.25rem",padding:"28px 40px"}}
                onClick={() => setScreen("walkin_details")}>
                 I don’t have a schedule
                <div style={{fontSize:"0.85rem",fontWeight:500,marginTop:6,opacity:0.8}}>Sign in</div>
              </button>
              <button className="kiosk-btn-primary" style={{fontSize:"1.25rem",padding:"28px 40px"}}
                onClick={() => setScreen("checkin_search")}>
                 I have a scheduled visit
                <div style={{fontSize:"0.85rem",fontWeight:500,marginTop:6,opacity:0.8}}>Search and check in</div>
              </button>
              <button className="kiosk-btn-secondary" style={{fontSize:"1.25rem",padding:"28px 40px",borderColor:"rgba(248,81,73,0.3)",color:"#f85149"}}
                onClick={() => setScreen("checkout_search")}>
                 Already checked in?
                <div style={{fontSize:"0.85rem",fontWeight:500,marginTop:6,opacity:0.8}}>Sign out</div>
              </button>
            </div>
          </div>
        )}

        {/* ── CHECK-IN SEARCH ───────────────────────────────────────────── */}
        {screen === "checkin_search" && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={resetToLanding}>← Back</button>
            <h2 style={styles.screenTitle}>Find your booking</h2>
            <p style={styles.screenSub}>Enter your name or email address</p>
            <div style={{display:"flex",gap:12,marginTop:24}}>
              <input
                className="kiosk-input"
                placeholder="Your name or email..."
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); const q = e.target.value.toLowerCase(); if (!q.trim()) { setSearchResults([]); return; } const today_start = new Date(); today_start.setHours(0,0,0,0); const r = (allVisits ?? []).filter((v) => { const nameMatch = (v.visitorName ?? "").toLowerCase().includes(q); const emailMatch = (v.visitorEmail ?? "").toLowerCase().includes(q); const phoneMatch = (v.visitorPhone ?? "").toLowerCase().includes(q); return (nameMatch || emailMatch || phoneMatch) && v.scheduledDate >= today_start.getTime(); }); setSearchResults(r); }}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                autoFocus
                style={{fontSize:"1.1rem",flex:1}}
              />
              <button className="kiosk-btn-primary" style={{width:"auto",padding:"16px 32px"}}
                onClick={handleSearch}>
                Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{marginTop:24,display:"flex",flexDirection:"column",gap:12}}>
                <div style={styles.resultLabel}>Select your booking:</div>
                {searchResults.map((v: any) => {
                  const host = staff.find((s: any) => s._id === v.hostStaffId || s._id === v.hostId);
                  return (
                    <div key={v._id} className="kiosk-card" onClick={() => { setSelectedVisit(v); setScreen("checkin_result"); }}>
                      <div style={{fontWeight:700,fontSize:"1rem",color:"#e6edf3"}}>{v.visitorName}</div>
                      <div style={{fontSize:"0.85rem",color:"#8b949e",marginTop:4}}>
                        {host ? `Visiting ${host.name}` : ""}
                        {v.purpose ? ` · ${v.purpose}` : ""}
                      </div>
                      <div style={{fontSize:"0.82rem",color:"#8b949e",marginTop:2}}>
                        {new Date(v.scheduledDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                        {" · "}
                        {new Date(v.scheduledDate).toLocaleDateString([],{month:"short",day:"numeric"})}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQ && searchResults.length === 0 && (
              <div style={styles.noResults}>
                No bookings found for "{searchQ}". Try a different name or email, or register as a walk-in.
              </div>
            )}
          </div>
        )}

        {/* ── CHECK-IN CONFIRM ──────────────────────────────────────────── */}
        {screen === "checkin_result" && selectedVisit && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={() => setScreen("checkin_search")}>← Back</button>
            <h2 style={styles.screenTitle}>Confirm check-in</h2>
            <div style={styles.confirmCard}>
              <div style={styles.visitorAvatar}>{(selectedVisit.visitorName??"V")[0].toUpperCase()}</div>
              <div style={styles.visitorName}>{selectedVisit.visitorName}</div>
              {(() => {
                const host = staff.find((s: any) => s._id === selectedVisit.hostStaffId || s._id === selectedVisit.hostId);
                return host ? <div style={styles.visitDetail}>Visiting <strong style={{color:"#e6edf3"}}>{host.name}</strong></div> : null;
              })()}
              <div style={styles.visitDetail}>
                {new Date(selectedVisit.scheduledDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                {selectedVisit.purpose ? ` · ${selectedVisit.purpose}` : ""}
              </div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button className="kiosk-btn-primary" style={{marginTop:24,fontSize:"1.15rem",padding:"22px"}}
              disabled={submitting} onClick={() => handleCheckIn(selectedVisit)}>
              {submitting ? "Checking in..." : " Confirm Check-in"}
            </button>
          </div>
        )}

        {/* ── CHECK-IN DONE ─────────────────────────────────────────────── */}
        {screen === "checkin_done" && (
          <div className="kiosk-fade" style={styles.center}>
            <div className="kiosk-check" style={{...styles.successIcon, background: primaryColor}}></div>
            <h1 style={styles.welcomeTitle}>You're checked in!</h1>
            <p style={styles.welcomeSub}>
              {selectedVisit?.visitorName ? `Welcome, ${selectedVisit.visitorName.split(" ")[0]}!` : "Welcome!"}
              {" "}Your host will be with you shortly.
            </p>
            <p style={{color:"#8b949e",fontSize:"0.85rem",marginTop:16}}>This screen will reset in a few seconds...</p>
          </div>
        )}

        {/* ── WALK-IN DETAILS ───────────────────────────────────────────── */}
        {screen === "walkin_details" && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={resetToLanding}>← Back</button>
            <h2 style={styles.screenTitle}>Book an appointment</h2>
            <div style={styles.fieldGrid}>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Full name <span style={{color:"#f85149"}}>*</span></label>
                <input className="kiosk-input" placeholder="Jane Mensah" value={form.visitorName}
                  onChange={e => set("visitorName", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email address{emailRequired && <span style={{color:"#f85149"}}> *</span>}</label>
                <input className="kiosk-input" type="email" placeholder="jane@company.com" value={form.visitorEmail}
                  onChange={e => set("visitorEmail", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone number{phoneRequired && <span style={{color:"#f85149"}}> *</span>}</label>
                <input className="kiosk-input" type="tel" placeholder="0244123456" maxLength={10} onKeyPress={(e)=>{if(!/[0-9]/.test(e.key))e.preventDefault()}} value={form.visitorPhone}
                  onChange={e => set("visitorPhone", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Company / Organisation{companyRequired && <span style={{color:"#f85149"}}> *</span>}</label>
                <input className="kiosk-input" placeholder="Acme Corp" value={form.visitorCompany}
                  onChange={e => set("visitorCompany", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Purpose of visit{purposeRequired && <span style={{color:"#f85149"}}> *</span>}</label>
                <select className="kiosk-select" value={form.purpose}
                  onChange={e => set("purpose", e.target.value)}>
                  <option value="">Select purpose</option>
                  {purposes.map((p: string) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Who are you visiting? <span style={{color:"#f85149"}}>*</span></label>
                <select className="kiosk-select" value={form.hostStaffId}
                  onChange={e => set("hostStaffId", e.target.value)}>
                  <option value="">Select a person</option>
                  {staff.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.name}{s.department ? " — " + s.department : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:24}}>
              <button className="kiosk-btn-primary" style={{width:"auto",padding:"16px 48px",fontSize:"1rem"}}
                disabled={!form.visitorName || !form.hostStaffId || (emailRequired && !form.visitorEmail) || (phoneRequired && !form.visitorPhone) || (companyRequired && !form.visitorCompany) || (purposeRequired && !form.purpose)}
                onClick={() => setScreen("walkin_datetime")}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── WALK-IN DATE/TIME ─────────────────────────────────────────── */}
        {screen === "walkin_datetime" && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={() => setScreen("walkin_details")}>← Back</button>
            <h2 style={styles.screenTitle}>Date and time</h2>
            <div style={styles.fieldGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Date <span style={{color:"#f85149"}}>*</span></label>
                <input className="kiosk-input" type="date" min={today} value={form.scheduledDate}
                  onChange={e => set("scheduledDate", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Time <span style={{color:"#f85149"}}>*</span></label>
                <input className="kiosk-input" type="time" value={form.scheduledTime}
                  onChange={e => set("scheduledTime", e.target.value)} />
              </div>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Duration</label>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}>
                  {durations.map(mins => (
                    <button key={mins} type="button"
                      onClick={() => set("duration", mins)}
                      style={{padding:"12px 24px",borderRadius:12,border:"1px solid",fontWeight:700,fontSize:"0.95rem",cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
                        background: form.duration===mins ? primaryColor : "rgba(255,255,255,0.06)",
                        color: form.duration===mins ? "#fff" : "#8b949e",
                        borderColor: form.duration===mins ? primaryColor : "rgba(255,255,255,0.12)"}}>
                      {mins<60?`${mins}m`:mins===60?"1h":mins===90?"1h 30m":"2h"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.fieldFull}>
                <label style={styles.label}>Additional notes</label>
                <textarea className="kiosk-input" rows={3} placeholder="Anything we should know..."
                  value={form.notes} onChange={e => set("notes", e.target.value)}
                  style={{resize:"none",fontFamily:"inherit"}} />
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:24}}>
              <button className="kiosk-btn-primary" style={{width:"auto",padding:"16px 48px",fontSize:"1rem"}}
                disabled={!form.scheduledDate || !form.scheduledTime}
                onClick={() => setScreen("walkin_review")}>
                Review →
              </button>
            </div>
          </div>
        )}

        {/* ── WALK-IN REVIEW ────────────────────────────────────────────── */}
        {screen === "walkin_review" && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={() => setScreen("walkin_datetime")}>← Back</button>
            <h2 style={styles.screenTitle}>Review your details</h2>
            <div style={styles.reviewGrid}>
              {[
                {label:"Name",    value:form.visitorName},
                {label:"Email",   value:form.visitorEmail||"—"},
                {label:"Phone",   value:form.visitorPhone||"—"},
                {label:"Company", value:form.visitorCompany||"—"},
                {label:"Visiting",value:selectedHost?.name||"—"},
                {label:"Purpose", value:form.purpose||"—"},
                {label:"Date",    value:form.scheduledDate ? new Date(form.scheduledDate).toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"}) : "—"},
                {label:"Time",    value:form.scheduledTime ? new Date("2000-01-01T"+form.scheduledTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"},
                {label:"Duration",value:form.duration<60?`${form.duration} min`:form.duration===60?"1 hour":form.duration===90?"1 hr 30 min":"2 hours"},
              ].map(({label,value}) => (
                <div key={label} style={styles.reviewRow}>
                  <span style={styles.reviewLabel}>{label}</span>
                  <span style={styles.reviewValue}>{value}</span>
                </div>
              ))}
            </div>
            {error && <div style={styles.error}>{error}</div>}
            
            <div style={{display:"flex",gap:12,marginTop:20}}>
              <button className="kiosk-btn-secondary" style={{fontSize:"0.95rem",padding:"16px"}}
                onClick={() => setScreen("walkin_details")}>
                Edit details
              </button>
              <button className="kiosk-btn-primary" style={{fontSize:"0.95rem",padding:"16px"}}
                disabled={submitting} onClick={handleWalkIn}>
                {submitting ? "Submitting..." : "Submit visit request"}
              </button>
            </div>
          </div>
        )}

        {/* ── CHECKOUT SEARCH ──────────────────────────────────────────── */}
        {screen === "checkout_search" && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={resetToLanding}>← Back</button>
            <h2 style={styles.screenTitle}>Check out</h2>
            <p style={styles.screenSub}>Enter your name, phone number or email</p>
            <div style={{display:"flex",gap:12,marginTop:24}}>
              <input className="kiosk-input" placeholder="Your name, phone or email..."
                value={checkoutQ} onChange={e => { const val = e.target.value; setCheckoutQ(val); const q = val.toLowerCase(); if (!q.trim()) { setCheckoutResults([]); return; } const r = (allVisits ?? []).filter((v) => { const nameMatch = (v.visitorName ?? "").toLowerCase().includes(q); const phoneMatch = (v.visitorPhone ?? "").toLowerCase().includes(q); const emailMatch = (v.visitorEmail ?? "").toLowerCase().includes(q); const active = ["checked_in","in_meeting","approved","accepted"].includes(v.status); return (nameMatch || phoneMatch || emailMatch) && active; }); setCheckoutResults(r); }}
                onKeyDown={e => e.key === "Enter" && handleCheckoutSearch()}
                autoFocus style={{fontSize:"1.1rem",flex:1}} />
              <button className="kiosk-btn-primary" style={{width:"auto",padding:"16px 32px"}}
                onClick={handleCheckoutSearch}>Search</button>
            </div>
            {checkoutResults.length > 0 && (
              <div style={{marginTop:24,display:"flex",flexDirection:"column",gap:12}}>
                <div style={styles.resultLabel}>Select your visit:</div>
                {checkoutResults.map((v: any) => {
                  const host = staff.find((s: any) => s._id === v.hostStaffId || s._id === v.hostId);
                  return (
                    <div key={v._id} className="kiosk-card" onClick={() => { setSelectedCheckout(v); setScreen("checkout_confirm"); }}>
                      <div style={{fontWeight:700,fontSize:"1rem",color:"#e6edf3"}}>{v.visitorName}</div>
                      <div style={{fontSize:"0.85rem",color:"#8b949e",marginTop:4}}>
                        {host ? `Visited ${host.name}` : ""}
                        {v.purpose ? ` · ${v.purpose}` : ""}
                      </div>
                      <div style={{fontSize:"0.82rem",color:"#8b949e",marginTop:2}}>
                        {new Date(v.scheduledDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {checkoutQ && checkoutResults.length === 0 && (
              <div style={styles.noResults}>No active visits found. Please see the receptionist.</div>
            )}
          </div>
        )}

        {/* ── CHECKOUT CONFIRM ─────────────────────────────────────────────── */}
        {screen === "checkout_confirm" && selectedCheckout && (
          <div className="kiosk-fade" style={styles.formWrap}>
            <button className="kiosk-back" onClick={() => setScreen("checkout_search")}>← Back</button>
            <h2 style={styles.screenTitle}>Confirm check-out</h2>
            <div style={styles.confirmCard}>
              <div style={{...styles.visitorAvatar,background:"#f85149"}}>{(selectedCheckout.visitorName??"V")[0].toUpperCase()}</div>
              <div style={styles.visitorName}>{selectedCheckout.visitorName}</div>
              {(() => {
                const host = staff.find((s: any) => s._id === selectedCheckout.hostStaffId || s._id === selectedCheckout.hostId);
                return host ? <div style={styles.visitDetail}>Visited <strong style={{color:"#e6edf3"}}>{host.name}</strong></div> : null;
              })()}
              <div style={styles.visitDetail}>
                {new Date(selectedCheckout.scheduledDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                {selectedCheckout.purpose ? ` · ${selectedCheckout.purpose}` : ""}
              </div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button className="kiosk-btn-primary" style={{marginTop:24,fontSize:"1.15rem",padding:"22px",background:"#f85149"}}
              disabled={submitting} onClick={() => handleCheckout(selectedCheckout)}>
              {submitting ? "Checking out..." : "Confirm Check-out"}
            </button>
          </div>
        )}

        {/* ── CHECKOUT DONE ────────────────────────────────────────────────── */}
        {screen === "checkout_done" && (
          <div className="kiosk-fade" style={styles.center}>
            <div className="kiosk-check" style={{...styles.successIcon, background:"#f85149"}}></div>
            <h1 style={styles.welcomeTitle}>Thank you, {selectedCheckout?.visitorName?.split(" ")[0]}!</h1>
            <p style={styles.welcomeSub}>You have been checked out. Have a great day!</p>
            <p style={{color:"#8b949e",fontSize:"0.85rem",marginTop:16}}>This screen will reset in a few seconds...</p>
          </div>
        )}

        {/* ── WALK-IN DONE ──────────────────────────────────────────────── */}
        {screen === "walkin_done" && (
          <div className="kiosk-fade" style={styles.center}>
            <div className="kiosk-check" style={{...styles.successIcon, background:"#f59e0b"}}></div>
            <h1 style={styles.welcomeTitle}>Request submitted!</h1>
            <p style={styles.welcomeSub}>
              Thank you, {form.visitorName.split(" ")[0]}! Your visit request has been received.
              Please take a seat — the team will be with you shortly.
            </p>
            <p style={{color:"#8b949e",fontSize:"0.85rem",marginTop:16}}>This screen will reset in a few seconds...</p>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={styles.footer}>
        Powered by <strong style={{color: primaryColor}}>Porta</strong>
        {screen !== "landing" && (
          <button onClick={resetToLanding}
            style={{marginLeft:24,background:"none",border:"none",color:"#8b949e",fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  root: { minHeight:"100vh", display:"flex", flexDirection:"column", color:"#e6edf3" },
  fullCenter: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0d1117" },
  loading: { color:"#8b949e", fontSize:"1rem" },
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 40px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.2)" },
  headerLeft: { display:"flex", alignItems:"center", gap:14 },
  brandMark: { width:40, height:40, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fff" },
  orgName: { fontSize:"1.1rem", fontWeight:700, color:"#e6edf3" },
  headerRight: { textAlign:"right" as const },
  clock: { fontSize:"1.3rem", fontWeight:700, color:"#e6edf3", fontVariantNumeric:"tabular-nums" },
  date: { fontSize:"0.78rem", color:"#8b949e", marginTop:2 },
  main: { flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" },
  center: { display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" as const, maxWidth:600, width:"100%" },
  welcomeIcon: { fontSize:"4rem", marginBottom:20 },
  welcomeTitle: { fontSize:"2.2rem", fontWeight:800, color:"#e6edf3", letterSpacing:"-0.03em", lineHeight:1.2 },
  welcomeSub: { fontSize:"1.05rem", color:"#8b949e", marginTop:12, lineHeight:1.6, maxWidth:460 },
  landingBtns: { display:"flex", flexDirection:"column" as const, gap:16, marginTop:40, width:"100%", maxWidth:480 },
  formWrap: { width:"100%", maxWidth:640, display:"flex", flexDirection:"column" as const },
  screenTitle: { fontSize:"1.6rem", fontWeight:800, color:"#e6edf3", marginTop:20, letterSpacing:"-0.02em" },
  screenSub: { fontSize:"0.95rem", color:"#8b949e", marginTop:8 },
  fieldGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:24 },
  field: { display:"flex", flexDirection:"column" as const, gap:8 },
  fieldFull: { display:"flex", flexDirection:"column" as const, gap:8, gridColumn:"1 / -1" },
  label: { fontSize:"0.82rem", fontWeight:600, color:"#8b949e", textTransform:"uppercase" as const, letterSpacing:"0.05em" },
  resultLabel: { fontSize:"0.85rem", fontWeight:600, color:"#8b949e", textTransform:"uppercase" as const, letterSpacing:"0.05em" },
  noResults: { marginTop:24, padding:"16px 20px", borderRadius:12, background:"rgba(248,81,73,0.08)", border:"1px solid rgba(248,81,73,0.2)", color:"#f85149", fontSize:"0.9rem", textAlign:"center" as const },
  confirmCard: { marginTop:24, padding:"28px", borderRadius:16, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", display:"flex", flexDirection:"column" as const, alignItems:"center", gap:8 },
  visitorAvatar: { width:64, height:64, borderRadius:"50%", background:"#3fb950", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:800 },
  visitorName: { fontSize:"1.3rem", fontWeight:700, color:"#e6edf3", marginTop:8 },
  visitDetail: { fontSize:"0.9rem", color:"#8b949e" },
  reviewGrid: { display:"flex", flexDirection:"column" as const, gap:0, marginTop:20, borderRadius:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)" },
  reviewRow: { display:"flex", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" },
  reviewLabel: { fontSize:"0.82rem", color:"#8b949e", fontWeight:600 },
  reviewValue: { fontSize:"0.9rem", color:"#e6edf3", fontWeight:500, textAlign:"right" as const, maxWidth:"60%" },
  successIcon: { width:80, height:80, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, color:"#fff", marginBottom:24 },
  error: { marginTop:12, padding:"12px 16px", borderRadius:10, background:"rgba(248,81,73,0.1)", border:"1px solid rgba(248,81,73,0.3)", color:"#f85149", fontSize:"0.9rem" },
  footer: { padding:"16px 40px", borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:"0.78rem", color:"#8b949e", textAlign:"center" as const, display:"flex", alignItems:"center", justifyContent:"center" },
};












