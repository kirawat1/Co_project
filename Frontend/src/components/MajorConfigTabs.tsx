import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import { useAdminRole } from "./adminRole";
import { getMajorFilter } from "../utils/majorFilter";

/* =========================================================================
   การตั้งค่าแยกหลักสูตร (Phase 4) — ครอบฟอร์มตั้งค่าเดิมของแต่ละหน้า
   แท็บ "ค่ากลาง" = ฟอร์มเดิม (เจ้าหน้าที่แก้ได้ · อาจารย์ประจำวิชาดูอย่างเดียว)
   แท็บหลักสูตร   = ติ๊ก "ใช้ค่าเฉพาะหลักสูตร" ทีละช่อง ช่องที่ไม่ติ๊กใช้ค่ากลาง (เจ้าหน้าที่แก้ค่ากลาง → เปลี่ยนตาม)
========================================================================= */

type FieldType = "bool" | "date" | "url" | "text" | "textarea";
interface FieldSpec { name: string; label: string; type: FieldType }

export default function MajorConfigTabs({ configKey, children }: { configKey: string; children: ReactNode }) {
  const { isStaff } = useAdminRole();
  const [majors, setMajors] = useState<string[]>([]);
  const [overridden, setOverridden] = useState<Record<string, string[]>>({});
  const [tab, setTab] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const r = await apiFetch("/api/admin/major-config");
      const d = r.ok ? await r.json() : null;
      if (!d?.ok) return;
      setMajors(d.majors ?? []);
      setOverridden(d.settings?.find((s: { key: string }) => s.key === configKey)?.overrides ?? {});
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, [configKey]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // แท็บเริ่มต้น: อาจารย์ประจำวิชา = หลักสูตรแรกที่ดูแล · เจ้าหน้าที่ = ตามตัวกรองบนแถบบน (ถ้ามี) ไม่งั้นค่ากลาง
  useEffect(() => {
    if (tab !== null || !loaded || (!isStaff && majors.length === 0)) return;
    const filter = getMajorFilter();
    setTab(!isStaff ? majors[0] : majors.includes(filter) ? filter : "");
  }, [isStaff, majors, tab, loaded]);

  const current = tab ?? "";

  return (
    <div>
      <div role="tablist" aria-label="ตั้งค่าของหลักสูตร" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginRight: 4 }}>ตั้งค่าของ:</span>
        <TabButton active={current === ""} onClick={() => setTab("")}>🌐 ค่ากลาง (ทุกหลักสูตร)</TabButton>
        {majors.map(m => (
          <TabButton key={m} active={current === m} onClick={() => setTab(m)} title={overridden[m]?.length ? `ตั้งค่าเฉพาะ: ${overridden[m].join(", ")}` : "ใช้ค่ากลางทั้งหมด"}>
            {m}{overridden[m]?.length ? " ✎" : ""}
          </TabButton>
        ))}
      </div>

      {current === "" ? (
        isStaff ? children : (
          <>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>🔒 ค่ากลางแก้ได้เฉพาะเจ้าหน้าที่ — เลือกแท็บหลักสูตรของคุณเพื่อตั้งค่าเฉพาะหลักสูตร</div>
            <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
          </>
        )
      ) : (
        <MajorOverrideEditor key={`${configKey}:${current}`} configKey={configKey} major={current} onSaved={loadSummary} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${active ? "#2563eb" : "#cbd5e1"}`,
        background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#334155",
      }}
    >
      {children}
    </button>
  );
}

function showValue(type: FieldType, v: unknown) {
  if (type === "bool") return v ? "เปิด" : "ปิด";
  if (v === null || v === undefined || v === "") return <span style={{ color: "#94a3b8" }}>(ว่าง)</span>;
  return String(v);
}

function MajorOverrideEditor({ configKey, major, onSaved }: { configKey: string; major: string; onSaved: () => void }) {
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [global, setGlobal] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch(`/api/admin/major-config/${configKey}?major=${encodeURIComponent(major)}`);
        const d = await r.json();
        if (!alive) return;
        if (!r.ok || !d.ok) { notify.error(d.message || "โหลดการตั้งค่าไม่สำเร็จ"); return; }
        setFields(d.fields);
        setGlobal(d.global ?? {});
        setDraft(d.override ?? {});
        setEnabled(new Set(Object.keys(d.override ?? {})));
      } catch { if (alive) notify.error("โหลดการตั้งค่าไม่สำเร็จ"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [configKey, major]);

  const toggle = (f: FieldSpec) => {
    const next = new Set(enabled);
    if (next.has(f.name)) next.delete(f.name);
    else {
      next.add(f.name);
      // เริ่มจากค่ากลาง จะได้แก้ต่อจากของเดิม
      setDraft(d => ({ ...d, [f.name]: d[f.name] ?? global[f.name] ?? (f.type === "bool" ? false : "") }));
    }
    setEnabled(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const override = Object.fromEntries([...enabled].map(n => [n, draft[n]]));
      const r = await apiFetch(`/api/admin/major-config/${configKey}?major=${encodeURIComponent(major)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { notify.error(d.message || "บันทึกไม่สำเร็จ"); return; }
      notify.success(`บันทึกการตั้งค่าของหลักสูตร ${major} แล้ว`);
      onSaved();
    } catch { notify.error("บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 16, color: "#64748b" }}>กำลังโหลด...</div>;

  return (
    <div style={{ border: "1px solid #bfdbfe", background: "#f8fbff", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
        {enabled.size === 0
          ? <>ℹ️ หลักสูตร <b>{major}</b> ใช้ค่ากลางทุกช่อง — ติ๊กช่องที่ต้องการให้ต่างจากค่ากลาง</>
          : <>✎ หลักสูตร <b>{major}</b> ตั้งค่าเฉพาะ {enabled.size} ช่อง — ช่องที่ไม่ติ๊กใช้ค่ากลาง (ถ้าเจ้าหน้าที่แก้ค่ากลาง จะเปลี่ยนตาม)</>}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {fields.map(f => {
          const on = enabled.has(f.name);
          return (
            <div key={f.name} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 220px) 1fr", gap: 12, alignItems: "start" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                <input type="checkbox" checked={on} onChange={() => toggle(f)} style={{ marginTop: 2, accentColor: "#2563eb" }} aria-label={`ใช้ค่าเฉพาะ ${major}: ${f.label}`} />
                <span>{f.label}<div style={{ fontWeight: 400, fontSize: 11, color: on ? "#1d4ed8" : "#94a3b8" }}>{on ? `ค่าเฉพาะ ${major}` : "ใช้ค่ากลาง"}</div></span>
              </label>
              <div>
                {!on ? (
                  <div style={{ fontSize: 13, color: "#64748b", background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {showValue(f.type, global[f.name])}
                  </div>
                ) : f.type === "bool" ? (
                  <select className="input" value={draft[f.name] ? "1" : "0"} onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value === "1" }))} style={{ width: "auto" }}>
                    <option value="1">เปิด</option>
                    <option value="0">ปิด</option>
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea className="input" rows={3} value={String(draft[f.name] ?? "")} onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))} />
                ) : (
                  <input
                    className="input"
                    type={f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
                    value={String(draft[f.name] ?? "")}
                    placeholder={f.type === "url" ? "https://..." : undefined}
                    onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : `💾 บันทึกของหลักสูตร ${major}`}
        </button>
      </div>
    </div>
  );
}
