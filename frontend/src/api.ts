// ─── AshaScan API client ────────────────────────────────────────────────────
// Talks to the FastAPI backend (backend/app/main.py).
// Set VITE_API_URL in your .env.local (dev) and in Vercel project settings (prod).

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("ashascan_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (data.detail?.message) return data.detail.message;
    if (data.detail?.quality_notes) return data.detail.quality_notes;
    return JSON.stringify(data.detail ?? data);
  } catch {
    return `Request failed (${res.status})`;
  }
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function login(phone: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: phone, password });
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  const data = await res.json();
  localStorage.setItem("ashascan_token", data.access_token);
}

export async function register(input: {
  name: string;
  phone: string;
  password: string;
  role?: "ASHA" | "ANM" | "PHC";
  village?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "ASHA", ...input }),
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
}

export function logout() {
  localStorage.removeItem("ashascan_token");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("ashascan_token");
}

export interface CurrentUser {
  id: number;
  name: string;
  phone: string;
  role: "ASHA" | "ANM" | "PHC";
  village?: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

// ─── Patients ───────────────────────────────────────────────────────────────

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender?: string | null;
  village?: string | null;
  created_at: string;
}

export async function createPatient(input: {
  name: string;
  age: number;
  gender?: string;
  village?: string;
}): Promise<Patient> {
  const res = await fetch(`${API_URL}/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function listPatients(search?: string): Promise<Patient[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_URL}/patients${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function getPatient(id: number): Promise<Patient> {
  const res = await fetch(`${API_URL}/patients/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function getPatientScreenings(id: number): Promise<ScreeningResult[]> {
  const res = await fetch(`${API_URL}/patients/${id}/screenings`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

// ─── Screenings ─────────────────────────────────────────────────────────────

export interface ScreeningResult {
  id: number;
  patient_id: number;
  risk_level: "green" | "yellow" | "red";
  confidence: number;
  model_version: string;
  screened_at: string;
}

export async function submitScreening(
  patientId: number,
  imageFile: File,
  captureSite: "eyelid" | "nail_bed" = "eyelid"
): Promise<ScreeningResult> {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("capture_site", captureSite);

  // The very first screening after a backend restart can be slow (the ML
  // model loads lazily unless preloaded). To avoid leaving the UI stuck if
  // the upload hangs while the server still finishes processing, we race
  // the upload against a polling fallback: if the upload hasn't completed
  // after a short grace period, start polling the patient's screenings and
  // return the screening if the server finishes first.
  const controller = new AbortController();
  // Allow longer total timeout for the upload (120s)
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  let fetchResolved = false;

  const fetchPromise = (async () => {
    const res = await fetch(`${API_URL}/patients/${patientId}/screenings`, {
      method: "POST",
      headers: authHeaders(), // do NOT set Content-Type manually — browser sets multipart boundary
      body: form,
      signal: controller.signal,
    });
    fetchResolved = true;
    if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
    return res.json() as Promise<ScreeningResult>;
  })();

  const pollStarter = (async () => {
    // Grace period before starting polling — lets fast uploads finish without extra requests
    await new Promise((r) => setTimeout(r, 8000));
    if (fetchResolved) return null as ScreeningResult | null;
    const pollResult = await pollForScreening(patientId, 60, 2000);
    if (pollResult) {
      // If polling found the screening, abort the upload request and return the result
      try { controller.abort(); } catch {}
      return pollResult;
    }
    return null as ScreeningResult | null;
  })();

  try {
    const result = await Promise.race([fetchPromise, pollStarter]);
    if (result === null) {
      // pollStarter finished with no result — wait for the upload to finish (or timeout)
      return await fetchPromise;
    }
    return result as ScreeningResult;
  } catch (e) {
    // If the upload was aborted due to our 120s timeout, try polling once more
    if (e instanceof DOMException && e.name === "AbortError") {
      const pollResult = await pollForScreening(patientId, 60, 2000);
      if (pollResult) return pollResult;
      throw new ApiError("Server took too long to respond. It may still be starting up — please try again in a moment.", 0);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}


async function pollForScreening(patientId: number, attempts = 60, delayMs = 2000): Promise<ScreeningResult | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_URL}/patients/${patientId}/screenings`, { headers: authHeaders() });
      if (res.ok) {
        const data: ScreeningResult[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Assume the most recent screening is first (backend orders by created_at desc)
          return data[0];
        }
      }
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// Maps backend risk vocabulary (green/yellow/red) to the frontend's RiskLevel type
export function mapRiskLevel(backendRisk: "green" | "yellow" | "red"): "low" | "possible" | "high" {
  if (backendRisk === "green") return "low";
  if (backendRisk === "yellow") return "possible";
  return "high";
}

// ─── Referrals ──────────────────────────────────────────────────────────────

export interface Referral {
  id: number;
  screening_id: number;
  patient_id: number;
  assigned_to?: number | null;
  status: "PENDING" | "REFERRED" | "OVERDUE" | "RESOLVED";
  due_date: string;
  resolved_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export async function listReferrals(status?: string): Promise<Referral[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_URL}/referrals${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard() {
  const res = await fetch(`${API_URL}/dashboard`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}