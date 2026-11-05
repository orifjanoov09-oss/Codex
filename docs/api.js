const SUPABASE_URL = "https://dllaqyrjecxjvbocqjzs.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_OZfXpOYauPEqayQmMva-RA_W1n3vH3e";

const messages = {
  INVALID_NAME: "F.I.O. kamida 3 ta belgidan iborat bo‘lishi kerak.",
  INVALID_GROUP: "Guruh nomini kiriting.",
  ATTEMPT_NOT_FOUND: "Urinish topilmadi. Yangi test boshlang.",
  ALREADY_SUBMITTED: "Bu natija avval yuborilgan.",
  INVALID_ADMIN_PASSWORD: "Неверный пароль администратора.",
  ADMIN_UNAUTHORIZED: "Сессия завершена. Войдите снова."
};

export async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = data?.message || data?.hint || `HTTP ${response.status}`;
    const code = Object.keys(messages).find((key) => raw.includes(key));
    const error = new Error(code ? messages[code] : "Server bilan aloqa uzildi. Qayta urinib ko‘ring.");
    error.code = code || "API_ERROR";
    throw error;
  }
  return data;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}

export function duration(start, end) {
  if (!start || !end) return "—";
  const seconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин ${seconds % 60} сек`;
}
