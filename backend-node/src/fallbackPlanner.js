import { DEFAULT_ORIGIN, haversineKm, normalizeItineraryResponse } from './contract.js';

const HANOI_POIS = [
  {
    stop_id: 'poi_tx_cafe_01',
    name: 'Laika Cafe - Hoàng Đạo Thúy',
    category: 'cafe',
    address: '34T Hoàng Đạo Thúy, Trung Hòa, Cầu Giấy / Thanh Xuân, Hà Nội',
    lat: 21.0074,
    lng: 105.8027,
    indoor: true,
    recommended_items: ['Trà đào cam sả ít đường', 'Americano đá'],
    estimated_cost_vnd: 65000,
    estimated_calories_kcal: 110,
    nutrition_note: 'Ít đường, thanh nhẹ dưới 120 kcal',
    nutrition_tags: ['eat_clean', 'low_sugar', 'balanced'],
    vibes: ['chill_cafe', 'photo_spot'],
  },
  {
    stop_id: 'poi_tx_cafe_02',
    name: 'The Coffee House - Vũ Trọng Phụng',
    category: 'cafe',
    address: '99 Vũ Trọng Phụng, Thanh Xuân, Hà Nội',
    lat: 20.9985,
    lng: 105.8072,
    indoor: true,
    recommended_items: ['Cold Brew cam tươi', 'Bánh mì que gà xé'],
    estimated_cost_vnd: 75000,
    estimated_calories_kcal: 220,
    nutrition_note: 'Cân bằng năng lượng, không kem béo',
    nutrition_tags: ['balanced', 'low_sugar'],
    vibes: ['chill_cafe', 'night_chill'],
  },
  {
    stop_id: 'poi_tx_cafe_03',
    name: 'All Day Coffee - Quang Trung',
    category: 'cafe',
    address: '55 Quang Trung, Hai Bà Trưng, Hà Nội',
    lat: 21.0189,
    lng: 105.8473,
    indoor: true,
    recommended_items: ['Cold Brew Cam Sả ít đường', 'Bánh chuối yến mạch'],
    estimated_cost_vnd: 95000,
    estimated_calories_kcal: 210,
    nutrition_note: 'Ít đường, năng lượng nhẹ buổi chiều',
    nutrition_tags: ['eat_clean', 'low_sugar', 'balanced'],
    vibes: ['chill_cafe', 'photo_spot'],
  },
  {
    stop_id: 'poi_tx_cafe_04',
    name: 'Kafa Cafe - Nguyễn Tuân',
    category: 'cafe',
    address: '90 Nguyễn Tuân, Thanh Xuân, Hà Nội',
    lat: 20.9998,
    lng: 105.8042,
    indoor: false,
    recommended_items: ['Bạc xỉu ít sữa', 'Hạt hướng dương'],
    estimated_cost_vnd: 45000,
    estimated_calories_kcal: 160,
    nutrition_note: 'Tiết kiệm chi phí, hợp ngồi vỉa hè thoáng',
    nutrition_tags: ['balanced'],
    vibes: ['chill_cafe', 'local_food'],
  },
  {
    stop_id: 'poi_tx_act_01',
    name: 'Công viên Thanh Xuân (Hồ Điều Hòa Nhân Chính)',
    category: 'activity',
    address: 'Ngã tư Hoàng Minh Giám - Khuất Duy Tiến, Thanh Xuân, Hà Nội',
    lat: 21.0038,
    lng: 105.7966,
    indoor: false,
    recommended_items: ['Đi bộ quanh hồ', 'Chụp ảnh hoàng hôn ngoài trời'],
    estimated_cost_vnd: 15000,
    estimated_calories_kcal: 0,
    nutrition_note: 'Vận động nhẹ đốt ~140 kcal',
    nutrition_tags: ['eat_clean', 'high_protein', 'low_sugar', 'balanced'],
    vibes: ['photo_spot', 'interactive_activity'],
  },
  {
    stop_id: 'poi_tx_act_02',
    name: 'Sân Trượt Băng & Bowling Royal City',
    category: 'activity',
    address: '72A Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
    lat: 21.0031,
    lng: 105.8154,
    indoor: true,
    recommended_items: ['1 lượt Bowling / Tham quan VCCA Art Center'],
    estimated_cost_vnd: 95000,
    estimated_calories_kcal: 0,
    nutrition_note: 'Hoạt động trong nhà mát mẻ, tránh mưa nắng',
    nutrition_tags: ['eat_clean', 'high_protein', 'low_sugar', 'balanced'],
    vibes: ['interactive_activity', 'photo_spot'],
  },
  {
    stop_id: 'poi_tx_act_03',
    name: 'Trung tâm Nghệ thuật Đương đại VCCA',
    category: 'activity',
    address: 'B1-R3 Vincom Mega Mall Royal City, 72A Nguyễn Trãi, Thanh Xuân, Hà Nội',
    lat: 21.0029,
    lng: 105.8151,
    indoor: true,
    recommended_items: ['Tham quan triển lãm nghệ thuật miễn phí', 'Góc chụp ảnh'],
    estimated_cost_vnd: 30000,
    estimated_calories_kcal: 0,
    nutrition_note: 'Không gian trong nhà yên tĩnh, miễn phí vé vào cửa',
    nutrition_tags: ['eat_clean', 'high_protein', 'low_sugar', 'balanced'],
    vibes: ['photo_spot', 'chill_cafe', 'interactive_activity'],
  },
  {
    stop_id: 'poi_tx_act_04',
    name: 'Tổ hợp Boardgame & Workshop Tô Tượng - Hapulico',
    category: 'activity',
    address: '85 Vũ Trọng Phụng, Thanh Xuân, Hà Nội',
    lat: 20.9977,
    lng: 105.8084,
    indoor: true,
    recommended_items: ['Chơi boardgame 2 giờ', 'Nước suối thanh lọc'],
    estimated_cost_vnd: 65000,
    estimated_calories_kcal: 40,
    nutrition_note: 'Trong nhà 100%, hợp đi nhóm bạn hoặc hẹn hò',
    nutrition_tags: ['eat_clean', 'low_sugar', 'balanced'],
    vibes: ['interactive_activity', 'night_chill'],
  },
  {
    stop_id: 'poi_tx_food_01',
    name: 'Góc Bếp Healthy - Salad & Cơm Gạo Lứt',
    category: 'food',
    address: '104 Ngụy Như Kon Tum, Nhân Chính, Thanh Xuân, Hà Nội',
    lat: 20.9989,
    lng: 105.8021,
    indoor: true,
    recommended_items: ['Ức gà nướng mật ong & cơm gạo lứt', 'Salad rau củ sốt mè'],
    estimated_cost_vnd: 95000,
    estimated_calories_kcal: 460,
    nutrition_note: '38g Protein, ít dầu mỡ, giàu chất xơ',
    nutrition_tags: ['eat_clean', 'high_protein', 'low_sugar'],
    vibes: ['local_food', 'chill_cafe'],
  },
  {
    stop_id: 'poi_tx_food_02',
    name: 'Phở Cuốn Hương Mai - Hoàng Đạo Thúy',
    category: 'food',
    address: '25T1 Hoàng Đạo Thúy, Trung Hòa, Cầu Giấy / Thanh Xuân, Hà Nội',
    lat: 21.0068,
    lng: 105.8019,
    indoor: true,
    recommended_items: ['Phở cuốn bò thanh đạm (1 phần)', 'Nộm rau cải tươi'],
    estimated_cost_vnd: 85000,
    estimated_calories_kcal: 410,
    nutrition_note: 'Nhiều rau xanh, thịt bò giàu đạm, ít chiên rán',
    nutrition_tags: ['eat_clean', 'high_protein', 'balanced', 'low_sugar'],
    vibes: ['local_food'],
  },
  {
    stop_id: 'poi_tx_food_03',
    name: 'Bún Chả Sinh Từ - Nguyễn Thị Định',
    category: 'food',
    address: '48 Nguyễn Thị Định, Trung Hòa, Cầu Giấy, Hà Nội',
    lat: 21.0079,
    lng: 105.8049,
    indoor: true,
    recommended_items: ['Bún chả thịt nạc nướng', 'Rau sống & nước mắm nhạt'],
    estimated_cost_vnd: 65000,
    estimated_calories_kcal: 540,
    nutrition_note: 'Cân bằng tinh bột và đạm, giá bình dân',
    nutrition_tags: ['balanced', 'high_protein'],
    vibes: ['local_food'],
  },
  {
    stop_id: 'poi_tx_food_04',
    name: 'Poke & Grain Bowl - Láng Hạ',
    category: 'food',
    address: '101 Láng Hạ, Đống Đa, Hà Nội',
    lat: 21.0148,
    lng: 105.8135,
    indoor: true,
    recommended_items: ['Salmon Poke Bowl cỡ vừa', 'Trà xanh không đường'],
    estimated_cost_vnd: 135000,
    estimated_calories_kcal: 490,
    nutrition_note: 'Omega-3 từ cá hồi, 34g Protein, ít đường',
    nutrition_tags: ['eat_clean', 'high_protein', 'low_sugar'],
    vibes: ['local_food', 'photo_spot'],
  },
  {
    stop_id: 'poi_tx_food_05',
    name: 'Cơm Niêu Tố Uyên - Lê Văn Lương',
    category: 'food',
    address: '62 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội',
    lat: 21.0056,
    lng: 105.8044,
    indoor: true,
    recommended_items: ['Cá kho tộ & canh cua rau đay', 'Cơm niêu vừa phần'],
    estimated_cost_vnd: 90000,
    estimated_calories_kcal: 590,
    nutrition_note: 'Bữa cơm gia đình đủ chất, ấm bụng',
    nutrition_tags: ['balanced'],
    vibes: ['local_food'],
  },
  {
    stop_id: 'poi_tx_food_06',
    name: 'Bánh Tráng Thịt Heo Giang Mỹ - Royal City',
    category: 'food',
    address: 'B2-R6 Royal City, 72A Nguyễn Trãi, Thanh Xuân, Hà Nội',
    lat: 21.0033,
    lng: 105.8159,
    indoor: true,
    recommended_items: ['Thịt heo hấp cuốn rau rừng (ít mỡ)', 'Nước chấm nêm vừa'],
    estimated_cost_vnd: 130000,
    estimated_calories_kcal: 470,
    nutrition_note: 'Cực nhiều rau sống thanh mát, đạm luộc ít dầu mỡ',
    nutrition_tags: ['eat_clean', 'high_protein', 'balanced'],
    vibes: ['local_food', 'night_chill'],
  },
  {
    stop_id: 'poi_tx_des_01',
    name: 'Chè Ngon & Sữa Chua Nếp Cẩm - Nguyễn Ngọc Vũ',
    category: 'dessert_chill',
    address: '132 Nguyễn Ngọc Vũ, Trung Hòa, Cầu Giấy, Hà Nội',
    lat: 21.0091,
    lng: 105.8087,
    indoor: true,
    recommended_items: ['Sữa chua hy lạp trái cây ít đường'],
    estimated_cost_vnd: 40000,
    estimated_calories_kcal: 165,
    nutrition_note: 'Lợi khuẩn tiêu hóa, ít đường tinh luyện',
    nutrition_tags: ['eat_clean', 'low_sugar', 'balanced'],
    vibes: ['night_chill', 'local_food'],
  },
  {
    stop_id: 'poi_tx_des_02',
    name: 'Phê La - Nguyễn Văn Lộc',
    category: 'dessert_chill',
    address: '24 Nguyễn Văn Lộc, Mộ Lao, Hà Đông / Thanh Xuân, Hà Nội',
    lat: 20.9852,
    lng: 105.7886,
    indoor: true,
    recommended_items: ['Ô long nhài sữa ít ngọt (30% đường)'],
    estimated_cost_vnd: 58000,
    estimated_calories_kcal: 185,
    nutrition_note: 'Giảm 70% đường mặc định',
    nutrition_tags: ['low_sugar', 'balanced'],
    vibes: ['night_chill', 'photo_spot', 'chill_cafe'],
  },
  {
    stop_id: 'poi_tx_des_03',
    name: 'Trà Chanh & Acoustic Góc Phố - Nguyễn Quý Đức',
    category: 'dessert_chill',
    address: '18 Nguyễn Quý Đức, Thanh Xuân Bắc, Hà Nội',
    lat: 20.9918,
    lng: 105.7988,
    indoor: false,
    recommended_items: ['Trà quất mật ong ít đường'],
    estimated_cost_vnd: 30000,
    estimated_calories_kcal: 95,
    nutrition_note: 'Nhẹ bụng, giá sinh viên cực tiết kiệm',
    nutrition_tags: ['low_sugar', 'eat_clean'],
    vibes: ['night_chill', 'chill_cafe'],
  },
  {
    stop_id: 'poi_tx_des_04',
    name: 'Tổ hợp Cafe & Acoustic Tầng 4 - Quan Nhân',
    category: 'dessert_chill',
    address: '115 Quan Nhân, Nhân Chính, Thanh Xuân, Hà Nội',
    lat: 21.0036,
    lng: 105.8104,
    indoor: true,
    recommended_items: ['Trà hoa cúc táo đỏ không đường'],
    estimated_cost_vnd: 55000,
    estimated_calories_kcal: 70,
    nutrition_note: 'Không caffeine, 70 kcal, thư giãn buổi tối trong nhà',
    nutrition_tags: ['eat_clean', 'low_sugar', 'balanced'],
    vibes: ['night_chill', 'chill_cafe'],
  },
];

const NUTRITION_BADGES = {
  eat_clean: 'Đạt chuẩn Eat Clean • Giàu đạm, ít dầu mỡ',
  high_protein: 'Giàu Protein • Phục hồi năng lượng hiệu quả',
  low_sugar: 'Kiểm soát đường • Nhẹ nhàng cả ngày',
  balanced: 'Cân bằng dinh dưỡng • Hợp lý chi phí',
};

function parseStartMinutes(startStr = '14:00') {
  const [h, m] = String(startStr).split(':').map((n) => Number(n));
  if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  return 14 * 60;
}

function formatClock(totalMinutes) {
  const wrapped = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function scorePoi(poi, origin, { vibes = [], nutrition_goal = 'balanced', maxStopBudget = 150000 }) {
  const distKm = haversineKm(origin.lat, origin.lng, poi.lat, poi.lng);
  let score = 100 - distKm * 12;

  const vibeHits = poi.vibes.filter((v) => vibes.includes(v)).length;
  score += vibeHits * 18;

  if (poi.nutrition_tags.includes(nutrition_goal)) {
    score += 24;
  }

  if (poi.estimated_cost_vnd <= maxStopBudget) {
    score += 15;
  } else {
    score -= (poi.estimated_cost_vnd - maxStopBudget) / 3000;
  }

  return { poi, distKm, score };
}

function orderByNearestNeighbor(origin, selectedPois) {
  const remaining = [...selectedPois];
  const ordered = [];
  let current = { lat: origin.lat, lng: origin.lng };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    ordered.push(picked);
    current = { lat: picked.lat, lng: picked.lng };
  }

  return ordered;
}

async function computeRouteGeometry(origin, stops, { useOsrm = true } = {}) {
  const waypoints = [
    { lat: origin.lat, lng: origin.lng },
    ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
  ];

  if (useOsrm && waypoints.length >= 2) {
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2200) });
      if (res.ok) {
        const json = await res.json();
        const route = json?.routes?.[0];
        if (route?.geometry?.coordinates?.length >= 2) {
          const polyline = route.geometry.coordinates.map(([lng, lat]) => [
            Number(lat.toFixed(6)),
            Number(lng.toFixed(6)),
          ]);
          const legs = Array.isArray(route.legs) ? route.legs : [];
          // legs[0] is origin -> stop[0]; legs[1..] are stop[i] -> stop[i+1]
          const legDistancesKm = [];
          const legMinutes = [];
          for (let i = 0; i < stops.length; i += 1) {
            if (i < stops.length - 1) {
              const leg = legs[i + 1];
              if (leg) {
                legDistancesKm.push(Number((leg.distance / 1000).toFixed(2)));
                legMinutes.push(Math.max(2, Math.round(leg.duration / 60)));
              } else {
                const km = Number(
                  (haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng) * 1.25).toFixed(2),
                );
                legDistancesKm.push(km);
                legMinutes.push(Math.max(2, Math.round((km / 20) * 60)));
              }
            } else {
              legDistancesKm.push(0);
              legMinutes.push(0);
            }
          }

          return {
            route_polyline: polyline,
            legDistancesKm,
            legMinutes,
            totalDistanceKm: Number((route.distance / 1000).toFixed(2)),
            totalTravelMinutes: Math.max(3, Math.round(route.duration / 60)),
          };
        }
      }
    } catch {
      // Fall back smoothly to Haversine road estimate
    }
  }

  const legDistancesKm = [];
  const legMinutes = [];
  let totalDistanceKm = 0;
  let totalTravelMinutes = 0;

  if (stops.length > 0) {
    const firstLegKm = haversineKm(origin.lat, origin.lng, stops[0].lat, stops[0].lng) * 1.25;
    totalDistanceKm += firstLegKm;
    totalTravelMinutes += Math.max(2, Math.round((firstLegKm / 20) * 60));
  }

  for (let i = 0; i < stops.length; i += 1) {
    if (i < stops.length - 1) {
      const km = Number(
        (haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng) * 1.25).toFixed(2),
      );
      const mins = Math.max(2, Math.round((km / 20) * 60));
      legDistancesKm.push(km);
      legMinutes.push(mins);
      totalDistanceKm += km;
      totalTravelMinutes += mins;
    } else {
      legDistancesKm.push(0);
      legMinutes.push(0);
    }
  }

  return {
    route_polyline: waypoints.map((w) => [w.lat, w.lng]),
    legDistancesKm,
    legMinutes,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalTravelMinutes,
  };
}

function buildStopFromPoi(poi, order, startMin, durationMin, origin, extraReason) {
  const distFromOrigin = haversineKm(origin.lat, origin.lng, poi.lat, poi.lng);
  return {
    order,
    stop_id: poi.stop_id,
    start_time: formatClock(startMin),
    end_time: formatClock(startMin + durationMin),
    name: poi.name,
    category: poi.category,
    address: poi.address,
    lat: poi.lat,
    lng: poi.lng,
    indoor: poi.indoor,
    recommended_items: poi.recommended_items,
    estimated_cost_vnd: poi.estimated_cost_vnd,
    estimated_calories_kcal: poi.estimated_calories_kcal,
    nutrition_note: poi.nutrition_note,
    ai_reason:
      extraReason ||
      `Phù hợp gu ${poi.vibes.slice(0, 2).join(', ')}, cách điểm xuất phát ${distFromOrigin.toFixed(1)}km`,
    distance_to_next_km: 0,
    travel_to_next_minutes: 0,
  };
}

/**
 * Spatial + budget + nutrition itinerary generator used when FastAPI (:8000) is offline.
 */
export async function generateFallbackItinerary(normalizedReq, options = {}) {
  const origin = normalizedReq.origin || DEFAULT_ORIGIN;
  const budget = normalizedReq.budget_vnd || 350000;
  const nutritionGoal = normalizedReq.nutrition_goal || 'balanced';
  const vibes = normalizedReq.vibes || [];

  const categoriesWanted = budget >= 280000
    ? ['cafe', 'activity', 'food', 'dessert_chill']
    : ['cafe', 'activity', 'food'];

  const pickedPois = [];
  let spentSoFar = 0;

  for (let idx = 0; idx < categoriesWanted.length; idx += 1) {
    const cat = categoriesWanted[idx];
    const remainingSlots = categoriesWanted.length - idx;
    const targetSlotBudget = Math.max(30000, Math.round((budget - spentSoFar) / remainingSlots));

    const candidates = HANOI_POIS.filter((p) => p.category === cat)
      .map((p) => scorePoi(p, origin, { vibes, nutrition_goal: nutritionGoal, maxStopBudget: targetSlotBudget }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      pickedPois.push(candidates[0].poi);
      spentSoFar += candidates[0].poi.estimated_cost_vnd;
    }
  }

  // Keep cafe first if possible, optimize middle/end stops spatially
  const ordered = orderByNearestNeighbor(origin, pickedPois);
  const startClock = parseStartMinutes(normalizedReq.time_window?.start || '14:00');
  const durations = [90, 95, 95, 75];

  let cursorMin = startClock;
  const stops = ordered.map((poi, idx) => {
    const dur = durations[idx] || 80;
    const built = buildStopFromPoi(poi, idx + 1, cursorMin, dur, origin);
    cursorMin += dur + 15;
    return built;
  });

  const routeInfo = await computeRouteGeometry(origin, stops, options);
  stops.forEach((s, idx) => {
    s.distance_to_next_km = routeInfo.legDistancesKm[idx] ?? 0;
    s.travel_to_next_minutes = routeInfo.legMinutes[idx] ?? 0;
  });

  const totalCost = stops.reduce((sum, s) => sum + s.estimated_cost_vnd, 0);
  const totalKcal = stops.reduce((sum, s) => sum + s.estimated_calories_kcal, 0);
  const shortArea = origin.label?.split(',')[0] || 'Thanh Xuân';

  return normalizeItineraryResponse(
    {
      summary: {
        title: `Lịch trình ${shortArea} • Tối ưu ${stops.length} chặng`,
        total_cost_per_person_vnd: totalCost,
        budget_per_person_vnd: budget,
        total_calories_kcal: totalKcal,
        nutrition_badge: NUTRITION_BADGES[nutritionGoal] || NUTRITION_BADGES.balanced,
        total_distance_km: routeInfo.totalDistanceKm,
        total_travel_minutes: routeInfo.totalTravelMinutes,
      },
      route_polyline: routeInfo.route_polyline,
      stops,
    },
    {
      fallbackBudgetVnd: budget,
      origin,
    },
  );
}

/**
 * Spatial & constraint-aware single-stop replanner when FastAPI (:8000) is offline.
 */
export async function replanFallbackItinerary(replanReq, currentItinerary, options = {}) {
  const baseItinerary = currentItinerary || (await generateFallbackItinerary({}, options));
  const currentStops = Array.isArray(baseItinerary.stops) ? [...baseItinerary.stops] : [];
  if (currentStops.length === 0) {
    return generateFallbackItinerary({ budget_vnd: replanReq.new_budget_vnd || 350000 }, options);
  }

  const targetOrder = Math.min(
    Math.max(1, Number(replanReq.target_stop_order) || 2),
    currentStops.length,
  );
  const targetIdx = currentStops.findIndex((s) => s.order === targetOrder);
  const replaceIndex = targetIdx >= 0 ? targetIdx : Math.min(1, currentStops.length - 1);
  const oldStop = currentStops[replaceIndex];

  const reason = replanReq.reason || 'rainy_weather';
  const prevBudget = Number(baseItinerary.summary?.budget_per_person_vnd) || 350000;
  const targetBudget =
    replanReq.new_budget_vnd ||
    (reason === 'tighter_budget' ? Math.max(120000, Math.round(prevBudget * 0.8)) : prevBudget);

  const usedIds = new Set(
    currentStops.filter((_, idx) => idx !== replaceIndex).map((s) => s.stop_id),
  );
  usedIds.add(oldStop.stop_id);

  let candidates = HANOI_POIS.filter((p) => !usedIds.has(p.stop_id));

  if (reason === 'rainy_weather') {
    const indoorOnly = candidates.filter((p) => p.indoor === true);
    if (indoorOnly.length > 0) candidates = indoorOnly;
  } else if (reason === 'tighter_budget') {
    const cheaper = candidates.filter((p) => p.estimated_cost_vnd < oldStop.estimated_cost_vnd);
    if (cheaper.length > 0) candidates = cheaper;
  } else if (reason === 'lower_calories') {
    const lighter = candidates.filter(
      (p) => p.estimated_calories_kcal <= oldStop.estimated_calories_kcal,
    );
    if (lighter.length > 0) candidates = lighter;
  }

  // Prefer same category first so the timeline stays cohesive
  const sameCategory = candidates.filter((p) => p.category === oldStop.category);
  const pool = sameCategory.length > 0 ? sameCategory : candidates;

  const anchorLat = oldStop.lat || DEFAULT_ORIGIN.lat;
  const anchorLng = oldStop.lng || DEFAULT_ORIGIN.lng;

  pool.sort((a, b) => {
    const distA = haversineKm(anchorLat, anchorLng, a.lat, a.lng);
    const distB = haversineKm(anchorLat, anchorLng, b.lat, b.lng);
    if (reason === 'tighter_budget') {
      return a.estimated_cost_vnd + distA * 5000 - (b.estimated_cost_vnd + distB * 5000);
    }
    if (reason === 'lower_calories') {
      return a.estimated_calories_kcal + distA * 20 - (b.estimated_calories_kcal + distB * 20);
    }
    return distA - distB;
  });

  const chosen = pool[0] || HANOI_POIS.find((p) => p.indoor) || HANOI_POIS[0];
  const reasonLabelMap = {
    rainy_weather: 'Đã chuyển sang điểm trong nhà tránh mưa gần lộ trình cũ',
    tighter_budget: `Đã đổi sang lựa chọn tiết kiệm hơn (${chosen.estimated_cost_vnd.toLocaleString('vi-VN')}đ)`,
    lower_calories: `Đã tối ưu sang món nhẹ calo hơn (${chosen.estimated_calories_kcal} kcal)`,
    crowded: 'Đã đổi sang điểm lân cận ít đông đúc hơn',
  };

  const replacementStop = {
    order: oldStop.order,
    stop_id: chosen.stop_id,
    start_time: oldStop.start_time,
    end_time: oldStop.end_time,
    name: chosen.name,
    category: chosen.category,
    address: chosen.address,
    lat: chosen.lat,
    lng: chosen.lng,
    indoor: chosen.indoor,
    recommended_items: chosen.recommended_items,
    estimated_cost_vnd: chosen.estimated_cost_vnd,
    estimated_calories_kcal: chosen.estimated_calories_kcal,
    nutrition_note: chosen.nutrition_note,
    ai_reason: reasonLabelMap[reason] || 'Đã tối ưu lại chặng theo yêu cầu thời gian thực',
    distance_to_next_km: 0,
    travel_to_next_minutes: 0,
  };

  currentStops[replaceIndex] = replacementStop;

  const originPoint =
    Array.isArray(baseItinerary.route_polyline) && baseItinerary.route_polyline.length > 0
      ? { lat: baseItinerary.route_polyline[0][0], lng: baseItinerary.route_polyline[0][1] }
      : DEFAULT_ORIGIN;

  const routeInfo = await computeRouteGeometry(originPoint, currentStops, options);
  currentStops.forEach((s, idx) => {
    s.distance_to_next_km = routeInfo.legDistancesKm[idx] ?? 0;
    s.travel_to_next_minutes = routeInfo.legMinutes[idx] ?? 0;
  });

  const totalCost = currentStops.reduce((sum, s) => sum + s.estimated_cost_vnd, 0);
  const totalKcal = currentStops.reduce((sum, s) => sum + s.estimated_calories_kcal, 0);

  return normalizeItineraryResponse(
    {
      itinerary_id: baseItinerary.itinerary_id,
      share_url: baseItinerary.share_url,
      summary: {
        ...baseItinerary.summary,
        total_cost_per_person_vnd: totalCost,
        budget_per_person_vnd: targetBudget,
        total_calories_kcal: totalKcal,
        total_distance_km: routeInfo.totalDistanceKm,
        total_travel_minutes: routeInfo.totalTravelMinutes,
      },
      route_polyline: routeInfo.route_polyline,
      stops: currentStops,
    },
    {
      itineraryId: baseItinerary.itinerary_id,
      shareUrl: baseItinerary.share_url,
      fallbackBudgetVnd: targetBudget,
      origin: originPoint,
    },
  );
}

/**
 * Return a pre-built Thanh Xuan showcase itinerary for GET /s/demo.
 */
export function getDemoItinerary(baseUrl = 'http://localhost:3000') {
  const cleanBase = String(baseUrl).replace(/\/+$/, '');
  const itinerary = {
    itinerary_id: 'itin_demo_thanhxuan',
    share_url: `${cleanBase}/s/demo`,
    summary: {
      title: 'Chiều Thanh Xuân Nhẹ Nhàng & Eat Clean (Demo)',
      total_cost_per_person_vnd: 255000,
      budget_per_person_vnd: 350000,
      total_calories_kcal: 750,
      nutrition_badge: 'Đạt chuẩn Eat Clean • Giàu đạm, ít đường',
      total_distance_km: 3.6,
      total_travel_minutes: 13,
    },
    route_polyline: [
      [21.0012, 105.8035],
      [20.9985, 105.8072],
      [21.0029, 105.8151],
      [20.9989, 105.8021],
      [21.0036, 105.8104],
    ],
    stops: [
      {
        order: 1,
        stop_id: 'poi_tx_cafe_02',
        start_time: '14:00',
        end_time: '15:30',
        name: 'The Coffee House - Vũ Trọng Phụng',
        category: 'cafe',
        address: '99 Vũ Trọng Phụng, Thanh Xuân, Hà Nội',
        lat: 20.9985,
        lng: 105.8072,
        indoor: true,
        recommended_items: ['Cold Brew cam tươi', 'Bánh mì que gà xé'],
        estimated_cost_vnd: 75000,
        estimated_calories_kcal: 220,
        nutrition_note: 'Cân bằng năng lượng, không kem béo',
        ai_reason: 'Cách điểm xuất phát Biblio chỉ 0.5km, không gian ngồi làm việc/trò chuyện thoáng đãng',
        distance_to_next_km: 1.1,
        travel_to_next_minutes: 4,
      },
      {
        order: 2,
        stop_id: 'poi_tx_act_03',
        start_time: '15:45',
        end_time: '17:15',
        name: 'Trung tâm Nghệ thuật Đương đại VCCA',
        category: 'activity',
        address: 'B1-R3 Royal City, 72A Nguyễn Trãi, Thanh Xuân, Hà Nội',
        lat: 21.0029,
        lng: 105.8151,
        indoor: true,
        recommended_items: ['Tham quan triển lãm nghệ thuật miễn phí', 'Góc chụp ảnh'],
        estimated_cost_vnd: 30000,
        estimated_calories_kcal: 0,
        nutrition_note: 'Không gian trong nhà mát mẻ, không lo mưa nắng',
        ai_reason: 'Hoạt động nghệ thuật sáng tạo trong nhà, miễn phí vé vào cửa tiết kiệm ngân sách',
        distance_to_next_km: 1.5,
        travel_to_next_minutes: 5,
      },
      {
        order: 3,
        stop_id: 'poi_tx_food_01',
        start_time: '17:30',
        end_time: '19:15',
        name: 'Góc Bếp Healthy - Salad & Cơm Gạo Lứt',
        category: 'food',
        address: '104 Ngụy Như Kon Tum, Thanh Xuân, Hà Nội',
        lat: 20.9989,
        lng: 105.8021,
        indoor: true,
        recommended_items: ['Ức gà nướng mật ong & cơm gạo lứt', 'Salad rau củ sốt mè'],
        estimated_cost_vnd: 95000,
        estimated_calories_kcal: 460,
        nutrition_note: '38g Protein, ít dầu mỡ, giàu chất xơ',
        ai_reason: 'Đáp ứng hoàn hảo mục tiêu Eat Clean với thực đơn giàu đạm ngay gần Nguyễn Như Kon Tum',
        distance_to_next_km: 1.0,
        travel_to_next_minutes: 4,
      },
      {
        order: 4,
        stop_id: 'poi_tx_des_04',
        start_time: '19:30',
        end_time: '20:45',
        name: 'Tổ hợp Cafe & Acoustic Tầng 4 - Quan Nhân',
        category: 'dessert_chill',
        address: '115 Quan Nhân, Nhân Chính, Thanh Xuân, Hà Nội',
        lat: 21.0036,
        lng: 105.8104,
        indoor: true,
        recommended_items: ['Trà hoa cúc táo đỏ không đường'],
        estimated_cost_vnd: 55000,
        estimated_calories_kcal: 70,
        nutrition_note: 'Không caffeine, 70 kcal, thư giãn buổi tối trong nhà',
        ai_reason: 'Kết thúc buổi tối nhẹ nhàng bằng nhạc Acoustic và trà thảo mộc không đường',
        distance_to_next_km: 0,
        travel_to_next_minutes: 0,
      },
    ],
  };

  return {
    itinerary_id: itinerary.itinerary_id,
    shortCode: 'demo',
    itinerary,
    participants: [
      { id: 'pt_demo_1', name: 'Khánh Linh', status: 'going', note: 'Chốt 14h có mặt!', joined_at: new Date().toISOString() },
      { id: 'pt_demo_2', name: 'Hoàng Minh', status: 'going', note: 'Mang máy ảnh nhé', joined_at: new Date().toISOString() },
    ],
    views: 1,
    replan_count: 0,
    ai_source: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
