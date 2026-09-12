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

  const res = await fetch(`${API_URL}/patients/${patientId}/screenings`, {
    method: "POST",
    headers: authHeaders(), // do NOT set Content-Type manually — browser sets multipart boundary
    body: form,
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

// Maps backend risk vocabulary (green/yellow/red) to the frontend's RiskLevel type
export function mapRiskLevel(backendRisk: "green" | "yellow" | "red"): "low" | "possible" | "high" {
  if (backendRisk === "green") return "low";
  if (backendRisk === "yellow") return "possible";
  return "high";
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard() {
  const res = await fetch(`${API_URL}/dashboard`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}
