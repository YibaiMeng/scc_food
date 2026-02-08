export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface FacilityMarker {
  business_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  postal_code: string;
  latest_date: string | null;
  latest_score: number | null;
  latest_result: string | null;
  inspection_count: number;
  critical_violation_count: number;
  has_recent_red: number; // 0 or 1
}

export interface Business {
  business_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  phone_number: string;
}

export interface Inspection {
  inspection_id: string;
  date: string;
  score: number | null;
  result: string | null;
  type: string;
  inspection_comment: string | null;
}

export interface Violation {
  code: string;
  description: string;
  critical: number;
  violation_comment: string | null;
}

export interface InspectionWithViolations extends Inspection {
  violations: Violation[];
}

export interface FacilityDetail {
  business: Business;
  inspections: InspectionWithViolations[];
}

export interface Stats {
  total_facilities: number;
  total_inspections: number;
  avg_score: number;
  result_distribution: { G: number; Y: number; R: number };
  critical_violations: number;
}
