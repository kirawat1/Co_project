// Wraps fetch() with the same 401 auto-logout behavior as the global axios
// interceptor in main.tsx — raw fetch() calls bypass that interceptor since
// it only attaches to axios.
// Auto-injects Authorization header from localStorage unless the caller
// provides one explicitly (caller's headers always win).
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("coop.token");
  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  };
  const res = await fetch(input, mergedInit);
  if (res.status === 401) {
    localStorage.removeItem("coop.token");
    if (window.location.pathname !== "/") {
      alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      window.location.href = "/";
    }
  }
  return res;
}
