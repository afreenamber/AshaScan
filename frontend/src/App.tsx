import { useState, useEffect, useRef } from "react";
import * as api from "./api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = "en" | "hi";
type SyncState = "synced" | "syncing" | "offline" | "saved";
type RiskLevel = "low" | "possible" | "high";
type Screen =
  | "splash" | "login" | "home"
  | "step1" | "step2-camera" | "step3-analysis"
  | "result-low" | "result-possible" | "result-high"
  | "patients" | "patient-profile"
  | "followups" | "profile";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  ivory: "#FAF7F2",
  ivoryDark: "#F0EDE8",
  teal: "#1A6B5A",
  tealDark: "#0D4A3C",
  tealLight: "#E4F0EC",
  terra: "#C1614A",
  terraLight: "#F8EDE9",
  charcoal: "#2C2C2C",
  charcoalMid: "#555555",
  charcoalLight: "#8A8A8A",
  border: "#E2DDD6",
  green: "#2D7A4F",
  greenLight: "#E8F5ED",
  greenDark: "#1A5C35",
  amber: "#B07A10",
  amberLight: "#FEF6E4",
  amberDark: "#7A5200",
  red: "#BE3525",
  redLight: "#FDECEA",
  redDark: "#8B1A0E",
};

// ─── i18n ─────────────────────────────────────────────────────────────────────

const strings: Record<string, Record<Lang, string>> = {
  startScreening:   { en: "Start Screening",         hi: "जांच शुरू करें" },
  patientDetails:   { en: "Patient Details",          hi: "मरीज़ की जानकारी" },
  continueBtn:      { en: "Continue",                 hi: "आगे बढ़ें" },
  screeningResult:  { en: "Screening Result",         hi: "जांच का परिणाम" },
  referHealth:      { en: "Refer to Health Centre",   hi: "स्वास्थ्य केंद्र भेजें" },
  referCheckup:     { en: "Refer for Check-up",       hi: "जांच के लिए भेजें" },
  save:             { en: "Save",                     hi: "सेव करें" },
  takePhoto:        { en: "Take Photo",               hi: "फ़ोटो लें" },
  retakePhoto:      { en: "Retake Photo",             hi: "दोबारा फ़ोटो लें" },
  checking:         { en: "Checking results…",        hi: "परिणाम जांचे जा रहे हैं…" },
  home:             { en: "Home",                     hi: "होम" },
  patients:         { en: "Patients",                 hi: "मरीज़" },
  followups:        { en: "Follow-ups",               hi: "फ़ॉलो-अप" },
  profile:          { en: "Profile",                  hi: "प्रोफ़ाइल" },
  lowRisk:          { en: "LOW RISK",                 hi: "कम जोखिम" },
  possibleRisk:     { en: "POSSIBLE RISK",            hi: "संभावित जोखिम" },
  highRisk:         { en: "HIGH RISK",                hi: "अधिक जोखिम" },
  scheduleFollowup: { en: "Schedule Follow-up",       hi: "फ़ॉलो-अप तय करें" },
  readyToScreen:    { en: "Ready to screen?",         hi: "जांच के लिए तैयार?" },
  recentScreenings: { en: "Recent screenings",        hi: "हाल की जांचें" },
  name:             { en: "Name",                     hi: "नाम" },
  age:              { en: "Age",                      hi: "उम्र" },
};

function t(key: string, lang: Lang): string {
  return strings[key]?.[lang] ?? strings[key]?.en ?? key;
}

// ─── Sync indicator ───────────────────────────────────────────────────────────

function SyncIndicator({ state }: { state: SyncState }) {
  const cfg = {
    synced:  { icon: "✓", text: "Synced",           color: C.green,       bg: C.greenLight },
    syncing: { icon: "↻", text: "Syncing…",         color: C.amber,       bg: C.amberLight },
    offline: { icon: "⌁", text: "Saved on phone",   color: C.charcoalMid, bg: C.ivoryDark },
    saved:   { icon: "✓", text: "Saved on phone",   color: C.charcoalMid, bg: C.ivoryDark },
  }[state];

  return (
    <div
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "Noto Sans, sans-serif" }}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
    >
      <span className={state === "syncing" ? "animate-spin-slow inline-block" : ""}>{cfg.icon}</span>
      <span>{cfg.text}</span>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function AshaScanLogo({ size = 40, color = C.teal }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="AshaScan">
      <circle cx="20" cy="7.5" r="4" fill={color} />
      <line x1="20" y1="11" x2="9.5" y2="33" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="20" y1="11" x2="30.5" y2="33" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      <polyline
        points="11,22.5 14.5,22.5 16,19 17.5,26 19,19.5 20.5,26 22,19 23.5,26 25,22.5 29,22.5"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"
      />
    </svg>
  );
}

// ─── Language switch ──────────────────────────────────────────────────────────

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      style={{ background: "rgba(255,255,255,0.18)", borderRadius: "20px" }}
      className="flex p-0.5"
    >
      {(["en", "hi"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            background: lang === l ? "#FFFFFF" : "transparent",
            color: lang === l ? C.teal : "rgba(255,255,255,0.8)",
            fontFamily: "Noto Sans, sans-serif",
          }}
          className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}

function LangSwitchDark({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      style={{ background: C.border, borderRadius: "20px" }}
      className="flex p-0.5"
    >
      {(["en", "hi"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            background: lang === l ? C.teal : "transparent",
            color: lang === l ? "#FFFFFF" : C.charcoalMid,
            fontFamily: "Noto Sans, sans-serif",
          }}
          className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
        >
          {l === "en" ? "EN" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function PrimaryButton({
  label, onClick, icon, disabled = false,
}: {
  label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#A0B8B3" : C.teal,
        fontFamily: "Outfit, sans-serif",
        minHeight: "56px",
      }}
      className="w-full rounded-2xl text-white text-[17px] font-bold flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all px-6"
    >
      {icon && <span className="text-xl">{icon}</span>}
      {label}
    </button>
  );
}

function SecondaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderColor: C.border,
        color: C.charcoalMid,
        fontFamily: "Outfit, sans-serif",
        minHeight: "52px",
        background: "#FFFFFF",
      }}
      className="w-full rounded-2xl border-2 text-[16px] font-semibold active:scale-[0.98] transition-all px-6"
    >
      {label}
    </button>
  );
}

function RiskBadge({ level, lang }: { level: RiskLevel; lang?: Lang }) {
  const l = lang ?? "en";
  const cfg = {
    low:      { label: t("lowRisk",      l), bg: C.greenLight, color: C.greenDark },
    possible: { label: t("possibleRisk", l), bg: C.amberLight, color: C.amberDark },
    high:     { label: t("highRisk",     l), bg: C.redLight,   color: C.redDark },
  }[level];
  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "Outfit, sans-serif" }}
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
    >
      {cfg.label}
    </span>
  );
}

function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{ background: i < step ? C.teal : C.border }}
          className="h-1.5 flex-1 rounded-full transition-all duration-400"
        />
      ))}
    </div>
  );
}

function BottomNav({ active, onChange, lang }: { active: string; onChange: (tab: string) => void; lang: Lang }) {
  const tabs = [
    { id: "home",      label: t("home",      lang), Icon: HomeIcon },
    { id: "patients",  label: t("patients",  lang), Icon: PatientsIcon },
    { id: "followups", label: t("followups", lang), Icon: FollowUpsIcon },
    { id: "profile",   label: t("profile",   lang), Icon: ProfileIcon },
  ];
  return (
    <nav
      style={{
        background: C.ivory,
        borderTop: `1.5px solid ${C.border}`,
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
      }}
      className="flex"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{ color: isActive ? C.teal : C.charcoalLight, fontFamily: "Noto Sans, sans-serif" }}
            className="flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors"
          >
            <Icon size={24} active={isActive} />
            <span className="text-[11px] font-semibold">{label}</span>
            {isActive && <div style={{ background: C.teal }} className="w-5 h-0.5 rounded-full" />}
          </button>
        );
      })}
    </nav>
  );
}

function InputField({ label, placeholder, type = "text", value, onChange }: {
  label: string; placeholder?: string; type?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label style={{ color: C.charcoalMid, fontFamily: "Outfit, sans-serif" }} className="text-base font-semibold">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "#FFFFFF", border: `2px solid ${C.border}`, color: C.charcoal, fontFamily: "Noto Sans, sans-serif" }}
        className="py-4 px-4 rounded-2xl text-[16px] outline-none"
      />
    </div>
  );
}

function PatientListItem({ name, age, time, risk, lang = "en", onClick }: {
  name: string; age: string; time: string; risk: RiskLevel; lang?: Lang; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }}
      className="w-full flex items-center gap-4 p-4 rounded-2xl active:scale-[0.99] transition-all text-left"
    >
      <div
        style={{ background: C.tealLight, color: C.teal, fontFamily: "Outfit, sans-serif" }}
        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
      >
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ color: C.charcoal, fontFamily: "Outfit, sans-serif" }} className="font-bold text-[15px]">
          {name}
        </div>
        <div style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm mt-0.5">
          {age} · {time}
        </div>
      </div>
      <RiskBadge level={risk} lang={lang} />
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon({ size = 24, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function PatientsIcon({ size = 24, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><path d="M3 21c0-3.584 2.686-6.5 6-6.5" />
      <circle cx="17" cy="9" r="2.5" /><path d="M13 21c0-2.761 1.791-5 4-5s4 2.239 4 5" />
    </svg>
  );
}
function FollowUpsIcon({ size = 24, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}
function ProfileIcon({ size = 24, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M5 12l7 7M5 12l7-7" />
    </svg>
  );
}
function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function CameraIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

// ─── Screen header helper ─────────────────────────────────────────────────────

function ScreenHeader({ step, total = 3, title, subtitle, onBack }: {
  step: number; total?: number; title: string; subtitle?: string; onBack: () => void;
}) {
  return (
    <div style={{ background: C.ivory, borderBottom: `1.5px solid ${C.border}` }} className="pt-12 pb-4 px-5">
      <button onClick={onBack} style={{ color: C.charcoalMid }} className="mb-4 p-1 -ml-1">
        <ArrowLeftIcon />
      </button>
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: C.teal, fontFamily: "Outfit, sans-serif" }} className="text-sm font-bold">
          STEP {step} OF {total}
        </span>
      </div>
      <ProgressBar step={step} total={total} />
      <h2 style={{ color: C.charcoal, fontFamily: "Outfit, sans-serif" }} className="text-2xl font-bold mt-3">
        {title}
      </h2>
      {subtitle && (
        <p style={{ color: C.charcoalMid, fontFamily: "Noto Sans" }} className="text-base mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ background: C.teal }} className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">
        <div style={{ border: "1.5px solid rgba(255,255,255,0.1)" }} className="absolute w-52 h-52 rounded-full" />
        <div style={{ border: "1.5px solid rgba(255,255,255,0.06)" }} className="absolute w-72 h-72 rounded-full" />
        <div className="animate-splash flex flex-col items-center gap-5">
          <AshaScanLogo size={76} color="#FFFFFF" />
          <div className="text-center">
            <h1 style={{ fontFamily: "Outfit, sans-serif", color: "#FFFFFF" }} className="text-4xl font-bold tracking-tight">
              AshaScan
            </h1>
            <p style={{ color: "rgba(255,255,255,0.72)" }} className="text-base mt-2">
              Screen quickly. Act confidently.
            </p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-12 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.45)", animationDelay: `${i * 220}ms` }}
            className="w-2 h-2 rounded-full animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginScreen({ lang, setLang, onLogin }: { lang: Lang; setLang: (l: Lang) => void; onLogin: () => void }) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!mobile || !password) {
      setError(lang === "en" ? "Enter your mobile number and password." : "मोबाइल नंबर और पासवर्ड दर्ज करें।");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.login(mobile, password);
      onLogin();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : (lang === "en" ? "Could not reach the server." : "सर्वर से संपर्क नहीं हो सका।"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: C.ivory }} className="absolute inset-0 flex flex-col overflow-auto">
      <div style={{ background: C.teal }} className="pt-14 pb-10 px-5">
        <div className="flex justify-end mb-6">
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
        <div className="flex flex-col items-center gap-4">
          <AshaScanLogo size={60} color="#FFFFFF" />
          <div className="text-center">
            <h1 style={{ fontFamily: "Outfit, sans-serif", color: "#FFFFFF" }} className="text-3xl font-bold">AshaScan</h1>
            <p style={{ color: "rgba(255,255,255,0.68)" }} className="text-sm mt-1.5">Anemia Risk Screening</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pt-8 pb-10 flex flex-col gap-5">
        <InputField
          label={lang === "en" ? "ASHA Worker ID or Mobile" : "ASHA वर्कर ID या मोबाइल"}
          placeholder={lang === "en" ? "Enter your ID or mobile number" : "अपना ID या नंबर दर्ज करें"}
          value={mobile}
          onChange={setMobile}
        />

        <InputField
          label={lang === "en" ? "Password" : "पासवर्ड"}
          placeholder={lang === "en" ? "Enter your password" : "अपना पासवर्ड दर्ज करें"}
          type="password"
          value={password}
          onChange={setPassword}
        />

        {error && (
          <p style={{ color: C.red, fontFamily: "Noto Sans" }} className="text-sm">{error}</p>
        )}

        <div className="pt-2">
          <PrimaryButton
            label={loading ? (lang === "en" ? "Signing in…" : "साइन इन हो रहा है…") : (lang === "en" ? "Continue →" : "आगे बढ़ें →")}
            onClick={handleSubmit}
            disabled={loading}
          />
        </div>

        <div className="mt-auto pt-6 flex flex-col items-center gap-1.5">
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-xs text-center">
            {lang === "en" ? "Need help? Contact your health supervisor." : "मदद चाहिए? अपने पर्यवेक्षक से संपर्क करें।"}
          </p>
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-[11px] text-center mt-1">
            National Health Mission · Ministry of Health &amp; Family Welfare
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── HOME / DASHBOARD ─────────────────────────────────────────────────────────

function timeAgo(iso: string, lang: Lang): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return lang === "en" ? "Just now" : "अभी";
  if (mins < 60) return lang === "en" ? `${mins}m ago` : `${mins} मिनट पहले`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return new Date(iso).toLocaleTimeString(lang === "en" ? "en-IN" : "hi-IN", { hour: "numeric", minute: "2-digit" });
  const days = Math.floor(hrs / 24);
  if (days === 1) return lang === "en" ? "Yesterday" : "कल";
  return lang === "en" ? `${days} days ago` : `${days} दिन पहले`;
}

function genderAgeLabel(p: api.Patient): string {
  const g = (p.gender || "").charAt(0).toUpperCase();
  return `${p.age}${g}`;
}

interface RecentItem { id: number; name: string; age: string; time: string; risk: RiskLevel }

function DashboardScreen({
  lang, setLang, sync, refreshKey, onStartScreening, onViewPatient,
}: {
  lang: Lang; setLang: (l: Lang) => void; sync: SyncState; refreshKey: number;
  onStartScreening: () => void; onViewPatient: (patientId: number) => void;
}) {
  const [stats, setStats] = useState<{ screened: number; followups: number; highRisk: number } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [dashboard, patients] = await Promise.all([
          api.getDashboard(),
          api.listPatients(),
        ]);

        if (cancelled) return;

        setStats({
          screened: dashboard.total_screenings ?? 0,
          followups: (dashboard.referrals?.pending ?? 0) + (dashboard.referrals?.overdue ?? 0),
          highRisk: 0, // filled in below once we know each patient's latest risk
        });

        // Latest screening per patient, for the top 5 most-recently-added patients.
        const top = patients.slice(0, 5);
        const withScreenings = await Promise.all(
          top.map(async (p) => {
            try {
              const screenings = await api.getPatientScreenings(p.id);
              const latest = screenings[screenings.length - 1];
              return { patient: p, latest };
            } catch {
              return { patient: p, latest: undefined };
            }
          })
        );

        if (cancelled) return;

        const items: RecentItem[] = withScreenings
          .filter((x) => x.latest)
          .map((x) => ({
            id: x.patient.id,
            name: x.patient.name,
            age: genderAgeLabel(x.patient),
            time: timeAgo(x.latest!.screened_at, lang),
            risk: api.mapRiskLevel(x.latest!.risk_level),
          }));

        setRecent(items);
        setStats((s) => (s ? { ...s, highRisk: items.filter((i) => i.risk === "high").length } : s));
      } catch {
        // Leave stats/recent empty — screen still renders with zeros.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    api.getCurrentUser()
      .then((u) => { if (!cancelled) setUserName(u.name); })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [refreshKey, lang]);

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      {/* Top bar */}
      <div style={{ background: C.teal }} className="pt-12 pb-5 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AshaScanLogo size={32} color="#FFFFFF" />
            <div>
              <p style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Noto Sans" }} className="text-xs">
                {lang === "en" ? "Welcome back" : "स्वागत है"}
              </p>
              <h1 style={{ fontFamily: "Outfit, sans-serif", color: "#FFFFFF" }} className="text-lg font-bold leading-tight">
                {userName || (lang === "en" ? "ASHA Worker" : "आशा कार्यकर्ता")}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncIndicator state={sync} />
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 pt-6 flex flex-col gap-6">
          {/* Hero CTA */}
          <div style={{ background: C.ivory, border: `1.5px solid ${C.border}` }} className="rounded-3xl p-5 flex flex-col gap-4">
            <h2 style={{ color: C.charcoal, fontFamily: "Outfit, sans-serif" }} className="text-xl font-bold">
              {t("readyToScreen", lang)}
            </h2>
            <PrimaryButton
              label={`+ ${t("startScreening", lang)}`}
              onClick={onStartScreening}
            />
          </div>

          {/* Today stats */}
          <div>
            <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-sm font-bold mb-3 uppercase tracking-wide">
              {lang === "en" ? "Today" : "आज"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: stats ? String(stats.screened) : "—", label: lang === "en" ? "Screened" : "जांचे गए" },
                { val: stats ? String(stats.followups) : "—", label: lang === "en" ? "Follow-ups" : "फ़ॉलो-अप" },
                { val: stats ? String(stats.highRisk) : "—", label: lang === "en" ? "High Risk" : "अधिक जोखिम" },
              ].map((s) => (
                <div key={s.label} style={{ background: C.ivory, border: `1.5px solid ${C.border}` }}
                  className="rounded-2xl p-4 flex flex-col gap-1">
                  <span style={{ fontFamily: "Outfit", color: C.teal }} className="text-3xl font-bold">{s.val}</span>
                  <span style={{ fontFamily: "Noto Sans", color: C.charcoalLight }} className="text-xs leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent screenings */}
          <div>
            <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-sm font-bold mb-3">
              {t("recentScreenings", lang)}
            </p>
            <div className="flex flex-col gap-2.5">
              {loading && (
                <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
                  {lang === "en" ? "Loading…" : "लोड हो रहा है…"}
                </p>
              )}
              {!loading && recent.length === 0 && (
                <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
                  {lang === "en" ? "No screenings yet." : "अभी तक कोई जांच नहीं।"}
                </p>
              )}
              {recent.map((p) => (
                <PatientListItem key={p.id} name={p.name} age={p.age} time={p.time} risk={p.risk} lang={lang} onClick={() => onViewPatient(p.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 1 — Patient Details ─────────────────────────────────────────────────

function ScreeningStep1({ lang, onBack, onNext }: {
  lang: Lang; onBack: () => void;
  onNext: (patient: { name: string; age: string; sex: string; village: string }) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [village, setVillage] = useState("");

  return (
    <div style={{ background: C.ivory }} className="absolute inset-0 flex flex-col">
      <ScreenHeader
        step={1}
        title={t("patientDetails", lang)}
        subtitle={lang === "en" ? "Enter basic information" : "बुनियादी जानकारी भरें"}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        <InputField
          label={t("name", lang)}
          placeholder={lang === "en" ? "Patient full name" : "मरीज़ का पूरा नाम"}
          value={name}
          onChange={setName}
        />

        <InputField
          label={t("age", lang)}
          placeholder={lang === "en" ? "Age in years" : "उम्र (साल में)"}
          type="number"
          value={age}
          onChange={setAge}
        />

        {/* Sex selector — large cards */}
        <div className="flex flex-col gap-2">
          <label style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-base font-semibold">
            {lang === "en" ? "Sex" : "लिंग"}
          </label>
          <div className="flex gap-3">
            {(lang === "en"
              ? [{ id: "F", label: "Female" }, { id: "M", label: "Male" }, { id: "O", label: "Other" }]
              : [{ id: "F", label: "महिला" }, { id: "M", label: "पुरुष" }, { id: "O", label: "अन्य" }]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setSex(s.id)}
                style={{
                  background: sex === s.id ? C.tealLight : "#FFFFFF",
                  border: `2px solid ${sex === s.id ? C.teal : C.border}`,
                  color: sex === s.id ? C.tealDark : C.charcoalMid,
                  fontFamily: "Noto Sans, sans-serif",
                  minHeight: "52px",
                }}
                className="flex-1 rounded-2xl text-base font-semibold transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Village */}
        <InputField
          label={lang === "en" ? "Village / Area" : "गांव / इलाका"}
          placeholder={lang === "en" ? "Village or ward name" : "गांव या वार्ड का नाम"}
          value={village}
          onChange={setVillage}
        />
      </div>

      <div style={{ background: C.ivory, borderTop: `1.5px solid ${C.border}` }} className="px-5 py-4">
        <PrimaryButton
          label={t("continueBtn", lang)}
          onClick={() => onNext({ name, age, sex, village })}
        />
      </div>
    </div>
  );
}

// ─── STEP 2 — Camera ──────────────────────────────────────────────────────────

function CameraScreen({ lang, onBack, onNext }: { lang: Lang; onBack: () => void; onNext: (file: File) => void }) {
  const [checks, setChecks] = useState({ light: false, clear: false, position: false });
  const [taken, setTaken] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const allGood = checks.light && checks.clear && checks.position;

  useEffect(() => {
    const t1 = setTimeout(() => setChecks((c) => ({ ...c, light: true })), 900);
    const t2 = setTimeout(() => setChecks((c) => ({ ...c, clear: true })), 1700);
    const t3 = setTimeout(() => setChecks((c) => ({ ...c, position: true })), 2500);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFileSelected = (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setTaken(true);
  };

  const handleRetake = () => {
    setTaken(false);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setChecks({ light: false, clear: false, position: false });
    setTimeout(() => {
      setTimeout(() => setChecks((c) => ({ ...c, light: true })), 700);
      setTimeout(() => setChecks((c) => ({ ...c, clear: true })), 1400);
      setTimeout(() => setChecks((c) => ({ ...c, position: true })), 2100);
    }, 100);
  };

  const checkItems = [
    { key: "light",    en: "Good lighting",     hi: "अच्छी रोशनी" },
    { key: "clear",    en: "Image clear",        hi: "साफ़ छवि" },
    { key: "position", en: "Correct position",   hi: "सही स्थिति" },
  ];

  return (
    <div style={{ background: "#1A1A1A" }} className="absolute inset-0 flex flex-col">
      {/* Header */}
      <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} className="pt-12 pb-3 px-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} style={{ color: "#FFFFFF" }} className="p-1 -ml-1"><ArrowLeftIcon /></button>
          <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Outfit" }} className="text-sm font-bold">
            STEP 2 OF 3
          </span>
          <div className="w-8" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: i < 2 ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
      </div>

      {/* Camera viewfinder */}
      <div className="flex-1 relative flex items-center justify-center px-5">
        <div style={{ background: "#2A2A2A", borderRadius: "16px", width: "100%", maxWidth: "340px", aspectRatio: "3/4" }}
          className="relative overflow-hidden flex items-center justify-center">
          {/* Real photo preview once captured */}
          {previewUrl ? (
            <img src={previewUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ top: `${i * 14}%`, background: "rgba(255,255,255,0.025)" }}
                  className="absolute left-0 right-0 h-px" />
              ))}
              <div style={{ border: "2.5px solid rgba(255,255,255,0.8)", borderRadius: "12px", width: "65%", aspectRatio: "1", position: "relative" }}>
                {[["top-0 left-0", "border-t-2 border-l-2"], ["top-0 right-0", "border-t-2 border-r-2"], ["bottom-0 left-0", "border-b-2 border-l-2"], ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border]) => (
                  <div key={pos} style={{ borderColor: C.teal }} className={`absolute w-5 h-5 ${pos} ${border}`} />
                ))}
              </div>
              <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: "8px" }}
                className="absolute bottom-4 left-4 right-4 px-3 py-2 text-center">
                <p style={{ color: "#FFFFFF", fontFamily: "Noto Sans" }} className="text-sm">
                  {lang === "en" ? "Place the eye inside the guide" : "आंख को बॉक्स के अंदर रखें"}
                </p>
              </div>
            </>
          )}

          {taken && (
            <div style={{ position: "absolute", top: 10, right: 10, background: C.green, borderRadius: "50%" }} className="w-9 h-9 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          )}
        </div>
      </div>

      {/* Hidden native input — on phones this opens the camera app directly */}
      <input
        id="ashascan-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {/* Bottom panel */}
      <div style={{ background: C.ivory, borderRadius: "24px 24px 0 0" }} className="px-5 pt-5 pb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {checkItems.map(({ key, en, hi }) => {
            const ok = checks[key as keyof typeof checks];
            return (
              <div key={key} className="flex items-center gap-3">
                <div style={{ background: ok ? C.greenLight : C.border, borderRadius: "50%" }}
                  className="w-6 h-6 flex items-center justify-center flex-shrink-0 transition-all">
                  {ok ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <div style={{ background: C.charcoalLight }} className="w-2 h-2 rounded-full animate-pulse" />
                  )}
                </div>
                <span style={{ color: ok ? C.green : C.charcoalLight, fontFamily: "Noto Sans" }} className="text-[15px] font-medium transition-colors">
                  {lang === "en" ? en : hi}
                </span>
              </div>
            );
          })}
        </div>

        {taken && file ? (
          <div className="flex flex-col gap-3">
            <PrimaryButton
              label={lang === "en" ? "Use this photo →" : "यह फ़ोटो इस्तेमाल करें →"}
              onClick={() => onNext(file)}
            />
            <SecondaryButton label={t("retakePhoto", lang)} onClick={handleRetake} />
          </div>
        ) : (
          <PrimaryButton
            label={t("takePhoto", lang)}
            onClick={() => document.getElementById("ashascan-camera-input")?.click()}
            icon={<CameraIcon size={22} />}
            disabled={!allGood}
          />
        )}
      </div>
    </div>
  );
}

// ─── STEP 3 — Analysis ────────────────────────────────────────────────────────

function AnalysisScreen({
  lang, patientId, file, onDone, onError,
}: {
  lang: Lang;
  patientId: number | null;
  file: File | null;
  onDone: (risk: RiskLevel) => void;
  onError: (message: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  // React.StrictMode (main.tsx) intentionally double-invokes effects in
  // dev mode to surface bugs. Without this guard, that double-invoke was
  // silently submitting every screening TWICE — creating two Screening
  // rows and two Referrals per photo. The `cancelled` flag below only
  // stopped the second invocation's *UI update*, not the actual network
  // request, which had already reached the server. This ref makes sure
  // only the first invocation for a given mount ever calls the API.
  const submittedRef = useRef(false);

    // onDone/onError are recreated on every render of the parent App
  // component (they're plain inline functions, not useCallback-wrapped).
  // If they were effect dependencies, ANY unrelated re-render of App
  // while this screen is showing would tear down and "restart" this
  // effect — cancelling the in-flight request's closure via `cancelled
  // = true` before it resolves, even though submittedRef correctly
  // blocks the actual duplicate network call. The result: the real
  // request finishes successfully on the server, but nothing is left
  // to call onDone() with it. Refs let us always call the *latest*
  // version of these callbacks without making them dependencies.
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  onDoneRef.current = onDone;
  onErrorRef.current = onError;

  useEffect(() => {
    const t1 = setTimeout(() => setTick(1), 500);
    const t2 = setTimeout(() => setTick(2), 1100);
    const slow = setTimeout(() => setShowSlowNotice(true), 6000);

    let cancelled = false;

    if (submittedRef.current) {
      return () => { submittedRef.current = false; [t1, t2, slow].forEach(clearTimeout); };
    }
    submittedRef.current = true;

    (async () => {
      if (!patientId || !file) {
        onErrorRef.current(lang === "en" ? "Missing patient or photo — please start again." : "मरीज़ या फ़ोटो नहीं मिली — दोबारा कोशिश करें।");
        return;
      }
      try {
        const result = await api.submitScreening(patientId, file, "eyelid");
        if (cancelled) return;
        setTick(3);
        setTimeout(() => onDoneRef.current(api.mapRiskLevel(result.risk_level)), 500);
      } catch (e) {
        if (cancelled) return;
        onErrorRef.current(e instanceof api.ApiError ? e.message : (lang === "en" ? "Could not reach the server." : "सर्वर से संपर्क नहीं हो सका।"));
      }
    })();

    return () => { cancelled = true; submittedRef.current = false; [t1, t2, slow].forEach(clearTimeout); };
  }, [patientId, file, lang]);

  const steps = lang === "en"
    ? ["Photo received", "Checking image", "Preparing result"]
    : ["फ़ोटो मिली", "जांच हो रही है", "परिणाम तैयार हो रहा है"];

  return (
    <div style={{ background: C.ivory }} className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative flex items-center justify-center">
          <div style={{ border: `2px solid ${C.tealLight}` }} className="absolute w-36 h-36 rounded-full animate-spin-slow" />
          <div style={{ background: C.tealLight, borderRadius: "50%" }} className="w-28 h-28 flex items-center justify-center">
            <AshaScanLogo size={60} color={C.teal} />
          </div>
        </div>
        <div>
          <h2 style={{ fontFamily: "Outfit, sans-serif", color: C.charcoal }} className="text-2xl font-bold">
            {t("checking", lang)}
          </h2>
          <p style={{ color: C.charcoalMid, fontFamily: "Noto Sans" }} className="text-base mt-2">
            {showSlowNotice
              ? (lang === "en"
                  ? "Still working — the first check after a restart can take up to a minute."
                  : "अभी भी काम हो रहा है — रीस्टार्ट के बाद पहली जांच में एक मिनट तक लग सकता है।")
              : (lang === "en" ? "You can wait — this takes a few seconds." : "थोड़ा रुकें, बस कुछ सेकंड।")}
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        {steps.map((label, i) => {
          const done = tick > i;
          const active = tick === i;
          return (
            <div key={label} style={{ opacity: done || active ? 1 : 0.3 }}
              className="flex items-center gap-4 transition-all duration-500">
              <div style={{
                background: done ? C.green : active ? C.tealLight : C.border,
                border: active ? `2px solid ${C.teal}` : "none",
              }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all">
                {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                {active && <div style={{ background: C.teal }} className="w-3 h-3 rounded-full animate-pulse" />}
              </div>
              <span style={{ color: done ? C.green : active ? C.charcoal : C.charcoalLight, fontFamily: "Noto Sans" }}
                className="text-base font-medium">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function RiskResultScreen({
  level, lang, patientId, onSave, onHome, onFollowup,
}: {
  level: RiskLevel; lang: Lang; patientId: number | null; onSave: () => void; onHome: () => void; onFollowup: () => void;
}) {
  const [patient, setPatient] = useState<api.Patient | null>(null);

  useEffect(() => {
    if (patientId == null) return;
    let cancelled = false;
    api.getPatient(patientId).then((p) => { if (!cancelled) setPatient(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [patientId]);

  const cfg = {
    low: {
      emoji: "🟢",
      label:   t("lowRisk",      lang),
      color:   C.greenDark,
      bg:      C.greenLight,
      border:  "#7DBC9E",
      message: lang === "en" ? "No immediate concern found." : "कोई तत्काल चिंता नहीं मिली।",
      advice:  lang === "en" ? "Continue healthy diet and routine care." : "स्वस्थ आहार और नियमित देखभाल जारी रखें।",
      cta:     lang === "en" ? "Save Result" : "सेव करें",
      showDiet: true,
    },
    possible: {
      emoji: "🟡",
      label:   t("possibleRisk", lang),
      color:   C.amberDark,
      bg:      C.amberLight,
      border:  "#D4A847",
      message: lang === "en" ? "Possible anemia risk." : "एनीमिया का संभावित जोखिम।",
      advice:  lang === "en" ? "A health centre check-up is recommended." : "स्वास्थ्य केंद्र में जांच कराना उचित है।",
      cta:     t("referCheckup", lang),
      showDiet: false,
    },
    high: {
      emoji: "🔴",
      label:   t("highRisk",     lang),
      color:   C.redDark,
      bg:      C.redLight,
      border:  "#D96A5A",
      message: lang === "en" ? "Further check-up is needed urgently." : "तुरंत जांच कराना ज़रूरी है।",
      advice:  lang === "en" ? "Please refer to a health facility as soon as possible." : "जल्द से जल्द स्वास्थ्य केंद्र भेजें।",
      cta:     t("referHealth",  lang),
      showDiet: false,
    },
  }[level];

  const dietCards = [
    { icon: "🥬", title: lang === "en" ? "Iron-rich Foods" : "आयरन युक्त भोजन",  body: lang === "en" ? "Palak, chana, rajma" : "पालक, चना, राजमा" },
    { icon: "🍋", title: lang === "en" ? "Vitamin C" : "विटामिन C",              body: lang === "en" ? "Amla, citrus fruits" : "आंवला, नींबू, संतरा" },
    { icon: "💧", title: lang === "en" ? "Hydration & Rest" : "पानी और आराम",    body: lang === "en" ? "Drink enough water" : "पर्याप्त पानी पिएं" },
  ];

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      {/* Coloured header */}
      <div style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.border}` }} className="pt-12 pb-6 px-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onHome} style={{ color: C.charcoalMid }} className="p-1 -ml-1"><ArrowLeftIcon /></button>
          <span style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-sm font-bold">
            {t("screeningResult", lang)}
          </span>
          <div className="w-8" />
        </div>

        {/* Large risk card */}
        <div style={{ background: "#FFFFFF", border: `2px solid ${cfg.border}`, borderRadius: "20px" }}
          className="flex flex-col items-center py-6 px-5 gap-2">
          <span className="text-5xl">{cfg.emoji}</span>
          <span style={{ color: cfg.color, fontFamily: "Outfit" }} className="text-3xl font-black tracking-tight mt-1">
            {cfg.label}
          </span>
          <p style={{ color: C.charcoalMid, fontFamily: "Noto Sans" }} className="text-base text-center">
            {cfg.message}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-8 flex flex-col gap-4">
        {/* Advice */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4">
          <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mb-2">
            {lang === "en" ? "What to do next" : "आगे क्या करें"}
          </p>
          <p style={{ color: C.charcoal, fontFamily: "Noto Sans" }} className="text-base leading-relaxed">
            {cfg.advice}
          </p>
          <div style={{ background: C.ivoryDark, borderRadius: "10px" }} className="px-3 py-2 mt-3">
            <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-xs">
              {lang === "en"
                ? "⚠️ This is a screening result — not a diagnosis. A qualified health worker must confirm."
                : "⚠️ यह जांच का परिणाम है — निदान नहीं। कृपया किसी स्वास्थ्यकर्मी से पुष्टि करवाएं।"}
            </p>
          </div>
        </div>

        {/* Dietary advice cards — only for low risk */}
        {cfg.showDiet && (
          <div>
            <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mb-3">
              {lang === "en" ? "Healthy eating tips" : "स्वस्थ खान-पान के सुझाव"}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {dietCards.map((d) => (
                <div key={d.title} style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }}
                  className="rounded-2xl p-3.5 flex flex-col items-center gap-2 text-center">
                  <span className="text-3xl">{d.icon}</span>
                  <span style={{ color: C.charcoal, fontFamily: "Outfit" }} className="text-xs font-bold leading-tight">{d.title}</span>
                  <span style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-[11px] leading-tight">{d.body}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient row */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-3.5 flex items-center gap-3">
          <div style={{ background: C.tealLight, color: C.teal, fontFamily: "Outfit" }} className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base">
            {(patient?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ color: C.charcoal, fontFamily: "Outfit" }} className="font-bold">{patient?.name || (lang === "en" ? "Patient" : "मरीज़")}</div>
            <div style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm">
              {patient ? `${genderAgeLabel(patient)} · ${patient.village || (lang === "en" ? "No village" : "गाँव नहीं")} · ${lang === "en" ? "Today" : "आज"}` : ""}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <PrimaryButton label={cfg.cta} onClick={onSave} />
          <div className="flex gap-3">
            <SecondaryButton label={t("save", lang)} onClick={onSave} />
            <SecondaryButton label={t("scheduleFollowup", lang)} onClick={onFollowup} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PATIENTS ─────────────────────────────────────────────────────────────────

function PatientsScreen({ lang, refreshKey, onSelect }: { lang: Lang; refreshKey: number; onSelect: (patientId: number) => void }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [filter, setFilter] = useState<"all" | RiskLevel>("all");

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const patients = await api.listPatients(search || undefined);
        const withScreenings = await Promise.all(
          patients.map(async (p) => {
            try {
              const screenings = await api.getPatientScreenings(p.id);
              const latest = screenings[screenings.length - 1];
              return { patient: p, latest };
            } catch {
              return { patient: p, latest: undefined };
            }
          })
        );
        if (cancelled) return;
        setItems(
          withScreenings.map((x) => ({
            id: x.patient.id,
            name: x.patient.name,
            age: genderAgeLabel(x.patient),
            time: x.latest ? timeAgo(x.latest.screened_at, lang) : (lang === "en" ? "Not yet screened" : "अभी जांच नहीं हुई"),
            risk: x.latest ? api.mapRiskLevel(x.latest.risk_level) : ("low" as RiskLevel),
          }))
        );
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300); // debounce search typing

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, refreshKey, lang]);

  const filters: { key: "all" | RiskLevel; en: string; hi: string }[] = [
    { key: "all", en: "All", hi: "सभी" },
    { key: "high", en: "High Risk", hi: "अधिक जोखिम" },
    { key: "possible", en: "Possible", hi: "संभावित" },
    { key: "low", en: "Low Risk", hi: "कम जोखिम" },
  ];

  const visible = filter === "all" ? items : items.filter((p) => p.risk === filter);

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      <div style={{ background: C.ivory, borderBottom: `1.5px solid ${C.border}` }} className="pt-12 pb-4 px-5">
        <h1 style={{ fontFamily: "Outfit", color: C.charcoal }} className="text-2xl font-bold mb-3">
          {t("patients", lang)}
        </h1>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: C.charcoalLight }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "en" ? "Search by name…" : "नाम से खोजें…"}
            style={{ background: "#FFFFFF", border: `2px solid ${C.border}`, color: C.charcoal, fontFamily: "Noto Sans", paddingLeft: "46px" }}
            className="w-full py-3.5 pr-4 rounded-2xl text-base outline-none"
          />
        </div>
        <div className="flex gap-2 mt-3">
          {filters.map((f) => (
            <button key={f.key}
              onClick={() => setFilter(f.key)}
              style={{ background: filter === f.key ? C.teal : "#FFFFFF", border: `1.5px solid ${filter === f.key ? C.teal : C.border}`, color: filter === f.key ? "#FFFFFF" : C.charcoalMid, fontFamily: "Noto Sans" }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {lang === "en" ? f.en : f.hi}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28 flex flex-col gap-2.5">
        {loading && (
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
            {lang === "en" ? "Loading…" : "लोड हो रहा है…"}
          </p>
        )}
        {!loading && visible.length === 0 && (
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
            {lang === "en" ? "No patients found." : "कोई मरीज़ नहीं मिला।"}
          </p>
        )}
        {visible.map((p) => (
          <PatientListItem key={p.id} name={p.name} age={p.age} time={p.time} risk={p.risk} lang={lang} onClick={() => onSelect(p.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── PATIENT PROFILE ──────────────────────────────────────────────────────────

function PatientProfileScreen({
  lang, patientId, onBack, onStartScreening,
}: {
  lang: Lang; patientId: number | null; onBack: () => void; onStartScreening: () => void;
}) {
  const [patient, setPatient] = useState<api.Patient | null>(null);
  const [screenings, setScreenings] = useState<api.ScreeningResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientId == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, s] = await Promise.all([
          api.getPatient(patientId),
          api.getPatientScreenings(patientId),
        ]);
        if (cancelled) return;
        setPatient(p);
        // Most recent first for display.
        setScreenings([...s].reverse());
      } catch {
        if (!cancelled) { setPatient(null); setScreenings([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const latest = screenings[0];
  const riskCfg = {
    low:      { bg: C.greenLight, border: "#7DBC9E", text: C.greenDark, label: t("lowRisk", lang) },
    possible: { bg: C.amberLight, border: "#D4A847", text: C.amberDark, label: t("possibleRisk", lang) },
    high:     { bg: C.redLight,   border: "#D96A5A", text: C.redDark,   label: t("highRisk", lang) },
  } as const;
  const latestLevel = latest ? api.mapRiskLevel(latest.risk_level) : null;

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      <div style={{ background: C.teal }} className="pt-12 pb-6 px-5">
        <button onClick={onBack} style={{ color: "rgba(255,255,255,0.8)" }} className="mb-4 p-1 -ml-1"><ArrowLeftIcon /></button>
        <div className="flex items-center gap-4">
          <div style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontFamily: "Outfit" }} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold">
            {(patient?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontFamily: "Outfit", color: "#FFFFFF" }} className="text-xl font-bold">
              {loading ? (lang === "en" ? "Loading…" : "लोड हो रहा है…") : (patient?.name || (lang === "en" ? "Unknown patient" : "अज्ञात मरीज़"))}
            </h2>
            {patient && (
              <p style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Noto Sans" }} className="text-base">
                {genderAgeLabel(patient)} · {patient.village || (lang === "en" ? "No village on file" : "गाँव दर्ज नहीं")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-8 flex flex-col gap-4">
        {/* Latest result */}
        {latest && latestLevel && (
          <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4">
            <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mb-3">
              {lang === "en" ? "Latest result" : "ताज़ा परिणाम"}
            </p>
            <div style={{ background: riskCfg[latestLevel].bg, border: `1.5px solid ${riskCfg[latestLevel].border}`, borderRadius: "14px" }}
              className="flex items-center justify-between px-4 py-3">
              <div>
                <span style={{ color: riskCfg[latestLevel].text, fontFamily: "Outfit" }} className="text-lg font-black">
                  {riskCfg[latestLevel].label}
                </span>
                <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm mt-0.5">
                  {new Date(latest.screened_at).toLocaleString(lang === "en" ? "en-IN" : "hi-IN")}
                </p>
              </div>
              <RiskBadge level={latestLevel} lang={lang} />
            </div>
          </div>
        )}

        {/* Screening history */}
        <div>
          <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mb-3">
            {lang === "en" ? "Screening history" : "जांच का इतिहास"}
          </p>
          {!loading && screenings.length === 0 && (
            <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm">
              {lang === "en" ? "No screenings recorded yet." : "अभी तक कोई जांच दर्ज नहीं।"}
            </p>
          )}
          <div className="relative pl-6">
            <div style={{ background: C.border, left: "10px" }} className="absolute top-0 bottom-0 w-0.5" />
            <div className="flex flex-col gap-3">
              {screenings.map((h, i) => {
                const lvl = api.mapRiskLevel(h.risk_level);
                return (
                  <div key={h.id} className="relative">
                    <div style={{ background: i === 0 ? C.amber : C.border, left: "-22px" }}
                      className="absolute w-5 h-5 rounded-full top-3 border-2 border-white" />
                    <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-3.5 flex items-center justify-between">
                      <div>
                        <div style={{ color: C.charcoal, fontFamily: "Outfit" }} className="font-bold text-sm">
                          {new Date(h.screened_at).toLocaleString(lang === "en" ? "en-IN" : "hi-IN")}
                        </div>
                        <div style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-xs mt-0.5">
                          {Math.round(h.confidence * 100)}% {lang === "en" ? "confidence" : "विश्वास"}
                        </div>
                      </div>
                      <RiskBadge level={lvl} lang={lang} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <PrimaryButton label={`+ ${t("startScreening", lang)}`} onClick={onStartScreening} />
      </div>
    </div>
  );
}

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

interface FollowupItem {
  id: number; name: string; age: string; risk: RiskLevel; date: string; next: string; status: "due" | "done";
}

function FollowUpsScreen({ lang, sync, refreshKey }: { lang: Lang; sync: SyncState; refreshKey: number }) {
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [referrals, patients] = await Promise.all([
          api.listReferrals(),
          api.listPatients(),
        ]);
        if (cancelled) return;

        const patientMap = new Map(patients.map((p) => [p.id, p]));

        // Referral responses don't include the screening's risk_level, so
        // pull each referred patient's screenings once and match by
        // screening_id (cached per patient to avoid duplicate calls).
        const screeningCache = new Map<number, api.ScreeningResult[]>();
        const getScreenings = async (patientId: number) => {
          if (!screeningCache.has(patientId)) {
            try {
              screeningCache.set(patientId, await api.getPatientScreenings(patientId));
            } catch {
              screeningCache.set(patientId, []);
            }
          }
          return screeningCache.get(patientId)!;
        };

        const items = await Promise.all(
          referrals.map(async (r): Promise<FollowupItem> => {
            const patient = patientMap.get(r.patient_id);
            const screenings = await getScreenings(r.patient_id);
            const screening = screenings.find((s) => s.id === r.screening_id);
            const risk = screening ? api.mapRiskLevel(screening.risk_level) : "possible";
            const isDone = r.status === "RESOLVED";
            const nextAction =
              r.status === "OVERDUE"
                ? (lang === "en" ? "Overdue — follow up now" : "समय निकल गया — अभी संपर्क करें")
                : risk === "high"
                ? (lang === "en" ? "Refer to health centre" : "स्वास्थ्य केंद्र भेजें")
                : (lang === "en" ? "Refer for check-up" : "जांच के लिए भेजें");

            return {
              id: r.id,
              name: patient?.name || (lang === "en" ? "Unknown patient" : "अज्ञात मरीज़"),
              age: patient ? genderAgeLabel(patient) : "",
              risk,
              date: timeAgo(r.created_at, lang),
              next: isDone ? (lang === "en" ? "Referral completed" : "रेफ़रल पूरा हुआ") : nextAction,
              status: isDone ? "done" : "due",
            };
          })
        );

        if (!cancelled) setFollowups(items);
      } catch {
        if (!cancelled) setFollowups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, lang]);

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      <div style={{ background: C.ivory, borderBottom: `1.5px solid ${C.border}` }} className="pt-12 pb-4 px-5">
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ fontFamily: "Outfit", color: C.charcoal }} className="text-2xl font-bold">
            {t("followups", lang)}
          </h1>
          <SyncIndicator state={sync} />
        </div>
        <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm">
          {lang === "en" ? `${followups.filter(f => f.status === "due").length} follow-ups due` : `${followups.filter(f => f.status === "due").length} फ़ॉलो-अप बाकी`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28 flex flex-col gap-3">
        {/* Due section */}
        <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase">
          {lang === "en" ? "Follow-up due" : "बाकी फ़ॉलो-अप"}
        </p>
        {loading && (
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
            {lang === "en" ? "Loading…" : "लोड हो रहा है…"}
          </p>
        )}
        {!loading && followups.filter(f => f.status === "due").length === 0 && (
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
            {lang === "en" ? "No follow-ups due." : "कोई फ़ॉलो-अप बाकी नहीं।"}
          </p>
        )}
        {followups.filter(f => f.status === "due").map((f) => (
          <div key={f.id} style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }}
            className="rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div style={{ background: C.tealLight, color: C.teal, fontFamily: "Outfit" }}
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0">
                  {f.name.charAt(0)}
                </div>
                <div>
                  <div style={{ color: C.charcoal, fontFamily: "Outfit" }} className="font-bold text-[15px]">{f.name}</div>
                  <div style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm">{f.age} · {f.date}</div>
                </div>
              </div>
              <RiskBadge level={f.risk} lang={lang} />
            </div>
            <div style={{ background: C.ivoryDark, borderRadius: "12px" }} className="px-3 py-2.5 flex items-center justify-between">
              <span style={{ color: C.charcoal, fontFamily: "Noto Sans" }} className="text-sm font-medium">{f.next}</span>
              <ChevronRight size={16} />
            </div>
            <div
              style={{ background: C.amberLight, borderRadius: "10px" }}
              className="flex items-center gap-2 px-3 py-2"
            >
              <span style={{ background: C.amber, borderRadius: "50%" }} className="w-2 h-2 flex-shrink-0" />
              <span style={{ color: C.amberDark, fontFamily: "Outfit" }} className="text-xs font-bold">
                {lang === "en" ? "FOLLOW-UP DUE" : "फ़ॉलो-अप बाकी"}
              </span>
            </div>
          </div>
        ))}

        {/* Done section */}
        <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mt-2">
          {lang === "en" ? "Completed" : "पूरे हो गए"}
        </p>
        {!loading && followups.filter(f => f.status === "done").length === 0 && (
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm px-1">
            {lang === "en" ? "Nothing completed yet." : "अभी तक कुछ पूरा नहीं हुआ।"}
          </p>
        )}
        {followups.filter(f => f.status === "done").map((f) => (
          <div key={f.id} style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}`, opacity: 0.7 }}
            className="rounded-2xl p-4 flex items-center gap-3">
            <div style={{ background: C.greenLight, color: C.green, fontFamily: "Outfit" }}
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0">
              {f.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div style={{ color: C.charcoal, fontFamily: "Outfit" }} className="font-bold text-[15px]">{f.name}</div>
              <div style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm">{f.age} · {f.date}</div>
            </div>
            <span style={{ background: C.greenLight, color: C.greenDark, fontFamily: "Outfit" }}
              className="text-xs font-bold px-3 py-1 rounded-full">
              {lang === "en" ? "DONE" : "पूरा"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfileScreen({ lang, setLang, sync, onLogout }: { lang: Lang; setLang: (l: Lang) => void; sync: SyncState; onLogout: () => void }) {
  const [user, setUser] = useState<api.CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getCurrentUser().then((u) => { if (!cancelled) setUser(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const initials = (user?.name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  return (
    <div style={{ background: C.ivoryDark }} className="absolute inset-0 flex flex-col">
      <div style={{ background: C.teal }} className="pt-12 pb-8 px-5 flex flex-col items-center gap-3">
        <div className="w-full flex justify-end mb-2">
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
        <div style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF", fontFamily: "Outfit" }}
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold">{initials}</div>
        <div className="text-center">
          <h2 style={{ fontFamily: "Outfit", color: "#FFFFFF" }} className="text-xl font-bold">
            {user?.name || (lang === "en" ? "Loading…" : "लोड हो रहा है…")}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Noto Sans" }} className="text-sm mt-0.5">
            {user ? `${user.role} · ${user.phone}` : ""}
          </p>
        </div>
        <SyncIndicator state={sync} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-28 flex flex-col gap-4">
        {/* Worker info */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4">
          {[
            { label: lang === "en" ? "Role" : "भूमिका",       value: user?.role || "—" },
            { label: lang === "en" ? "Phone" : "फ़ोन",         value: user?.phone || "—" },
            { label: lang === "en" ? "Village" : "गाँव",       value: user?.village || (lang === "en" ? "Not set" : "दर्ज नहीं") },
          ].map((r) => (
            <div key={r.label} style={{ borderBottom: `1px solid ${C.border}` }} className="flex justify-between py-3.5 last:border-0">
              <span style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-base">{r.label}</span>
              <span style={{ color: C.charcoal, fontFamily: "Noto Sans" }} className="text-base font-semibold">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Language */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4 flex items-center justify-between">
          <span style={{ color: C.charcoal, fontFamily: "Outfit" }} className="text-base font-semibold">
            {lang === "en" ? "Language" : "भाषा"}
          </span>
          <LangSwitchDark lang={lang} onChange={setLang} />
        </div>

        {/* Sync status */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4">
          <p style={{ color: C.charcoalMid, fontFamily: "Outfit" }} className="text-xs font-bold uppercase mb-2">
            {lang === "en" ? "Data & Sync" : "डेटा और सिंक"}
          </p>
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-sm leading-relaxed">
            {lang === "en"
              ? "Your work is saved on this phone. It will sync automatically when connected to internet."
              : "आपका काम इस फ़ोन पर सेव है। इंटरनेट मिलते ही अपने आप सिंक हो जाएगा।"}
          </p>
        </div>

        {/* About */}
        <div style={{ background: "#FFFFFF", border: `1.5px solid ${C.border}` }} className="rounded-2xl p-4">
          <p style={{ color: C.charcoalLight, fontFamily: "Noto Sans" }} className="text-xs leading-relaxed">
            AshaScan v1.2 · National Health Mission, India
            <br />
            {lang === "en" ? "Results must be confirmed by a qualified health worker." : "परिणाम की पुष्टि किसी स्वास्थ्यकर्मी से करवाएं।"}
          </p>
        </div>

        <button
          onClick={onLogout}
          style={{ background: C.redLight, color: C.redDark, border: `2px solid #E8B0A8`, fontFamily: "Outfit", minHeight: "52px" }}
          className="w-full rounded-2xl font-bold text-base"
        >
          {lang === "en" ? "Logout" : "लॉग आउट"}
        </button>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [activeTab, setActiveTab] = useState("home");
  const [lang, setLang] = useState<Lang>("en");
  const [sync] = useState<SyncState>("synced");
  const [resultLevel, setResultLevel] = useState<RiskLevel>("possible");

  const [currentPatientId, setCurrentPatientId] = useState<number | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = () => setDataVersion((v) => v + 1);

  const go = (s: Screen) => setScreen(s);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "home")      go("home");
    if (tab === "patients")  go("patients");
    if (tab === "followups") go("followups");
    if (tab === "profile")   go("profile");
  };

  const handlePatientDetailsSubmitted = async (patient: { name: string; age: string; sex: string; village: string }) => {
    setScreeningError(null);
    try {
      const created = await api.createPatient({
        name: patient.name || "Unnamed patient",
        age: parseInt(patient.age, 10) || 0,
        gender: patient.sex || undefined,
        village: patient.village || undefined,
      });
      setCurrentPatientId(created.id);
      go("step2-camera");
    } catch (e) {
      setScreeningError(e instanceof api.ApiError ? e.message : "Could not save patient details. Check your connection.");
    }
  };

  const handlePhotoCaptured = (file: File) => {
    setCapturedFile(file);
    go("step3-analysis");
  };

  const handleAnalysisDone = (risk: RiskLevel) => {
    setResultLevel(risk);
    refreshData();
    go(`result-${risk}` as Screen);
  };

  const handleAnalysisError = (message: string) => {
    setScreeningError(message);
    go("step2-camera");
  };

  const showNav = ["home", "patients", "followups", "profile"].includes(screen);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: C.ivoryDark }}>
      {screeningError && screen !== "step3-analysis" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, background: C.redDark, color: "#FFFFFF", fontFamily: "Noto Sans" }}
          className="px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{screeningError}</span>
          <button onClick={() => setScreeningError(null)} style={{ color: "#FFFFFF" }} className="font-bold">✕</button>
        </div>
      )}

      {screen === "splash"         && <SplashScreen onDone={() => go("login")} />}
      {screen === "login"          && <LoginScreen lang={lang} setLang={setLang} onLogin={() => { go("home"); setActiveTab("home"); }} />}
      {screen === "home"           && <DashboardScreen lang={lang} setLang={setLang} sync={sync} refreshKey={dataVersion} onStartScreening={() => go("step1")} onViewPatient={(id) => { setSelectedPatientId(id); go("patient-profile"); }} />}
      {screen === "step1"          && <ScreeningStep1 lang={lang} onBack={() => go("home")} onNext={handlePatientDetailsSubmitted} />}
      {screen === "step2-camera"   && <CameraScreen lang={lang} onBack={() => go("step1")} onNext={handlePhotoCaptured} />}
      {screen === "step3-analysis" && <AnalysisScreen lang={lang} patientId={currentPatientId} file={capturedFile} onDone={handleAnalysisDone} onError={handleAnalysisError} />}
      {screen === "result-low"     && <RiskResultScreen level="low"      lang={lang} patientId={currentPatientId} onSave={() => go("home")} onHome={() => go("home")} onFollowup={() => go("followups")} />}
      {screen === "result-possible"&& <RiskResultScreen level="possible" lang={lang} patientId={currentPatientId} onSave={() => go("home")} onHome={() => go("home")} onFollowup={() => go("followups")} />}
      {screen === "result-high"    && <RiskResultScreen level="high"     lang={lang} patientId={currentPatientId} onSave={() => go("home")} onHome={() => go("home")} onFollowup={() => go("followups")} />}
      {screen === "patients"       && <PatientsScreen lang={lang} refreshKey={dataVersion} onSelect={(id) => { setSelectedPatientId(id); go("patient-profile"); }} />}
      {screen === "patient-profile"&& <PatientProfileScreen lang={lang} patientId={selectedPatientId} onBack={() => setScreen(activeTab === "patients" ? "patients" : "home")} onStartScreening={() => go("step1")} />}
      {screen === "followups"      && <FollowUpsScreen lang={lang} sync={sync} refreshKey={dataVersion} />}
      {screen === "profile"        && <ProfileScreen lang={lang} setLang={setLang} sync={sync} onLogout={() => { api.logout(); go("login"); }} />}

      {showNav && <BottomNav active={activeTab} onChange={handleTabChange} lang={lang} />}
    </div>
  );
}
