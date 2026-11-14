// JSON API Contract — HACKATHON_PLAN.md Mục 7. KHÔNG đổi tên field nếu chưa báo cả nhóm.

export type Vibe =
  | 'chill_cafe'
  | 'interactive_activity'
  | 'local_food'
  | 'photo_spot'
  | 'night_chill';

export type NutritionGoal = 'balanced' | 'eat_clean' | 'high_protein' | 'low_sugar';

export type ReplanReason = 'rainy_weather' | 'crowded' | 'tighter_budget' | 'lower_calories';

export interface Origin {
  lat: number;
  lng: number;
  label: string;
}

export interface GenerateRequest {
  origin: Origin;
  budget_vnd: number;
  people_count: number;
  vibes: Vibe[];
  nutrition_goal: NutritionGoal;
  time_window: { start: string; end: string };
  prompt_note: string;
}

export interface ItinerarySummary {
  title: string;
  total_cost_per_person_vnd: number;
  budget_per_person_vnd: number;
  total_calories_kcal: number;
  nutrition_badge: string;
  total_distance_km: number;
  total_travel_minutes: number;
}

export interface Stop {
  order: number;
  stop_id: string;
  start_time: string;
  end_time: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  recommended_items: string[];
  estimated_cost_vnd: number;
  estimated_calories_kcal: number;
  nutrition_note: string;
  ai_reason: string;
  distance_to_next_km: number | null;
  travel_to_next_minutes: number | null;
}

export interface ItineraryResponse {
  itinerary_id: string;
  share_url: string;
  summary: ItinerarySummary;
  route_polyline: [number, number][];
  stops: Stop[];
}

export interface ReplanRequest {
  current_itinerary: ItineraryResponse;
  target_stop_order: number;
  reason: ReplanReason;
  new_budget_vnd: number;
}

/** State lưu trong AsyncStorage để khôi phục sau khi force-close app. */
export interface SavedPlan {
  itinerary: ItineraryResponse;
  request: GenerateRequest;
  saved_at: string;
  is_sample: boolean;
  /** Header X-AI-Source của backend-node: 'fastapi' (AI thật) | 'fallback' (dự phòng, không AI). */
  ai_source?: string | null;
}
