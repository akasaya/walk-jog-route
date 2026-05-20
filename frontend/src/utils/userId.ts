const USER_ID_KEY = "walkJogUserId";

export function getUserId(): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const newId = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, newId);
  return newId;
}
