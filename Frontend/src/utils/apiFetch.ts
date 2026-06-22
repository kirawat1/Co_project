// Wraps fetch() with the same 401 auto-logout behavior as the global axios
// interceptor in main.tsx — raw fetch() calls bypass that interceptor since
// it only attaches to axios.
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    localStorage.removeItem("coop.token");
    if (window.location.pathname !== "/") {
      alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      window.location.href = "/";
    }
  }
  return res;
}
