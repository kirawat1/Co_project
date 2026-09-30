import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

// หลักสูตรที่ผู้ใช้จัดการได้ — เจ้าหน้าที่ all=true · อาจารย์ประจำวิชา = หลักสูตรที่ดูแล
export interface MyScope { all: boolean; majors: string[] }

export function useMyScope(): MyScope | null {
  const [scope, setScope] = useState<MyScope | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch("/api/admin/my-scope")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.ok) setScope({ all: !!d.all, majors: d.majors ?? [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return scope;
}
