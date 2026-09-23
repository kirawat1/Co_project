import type { CSSProperties } from "react";
import { ADDRESS_FIELDS, addressFieldName, composeAddress, hasAddressParts, readAddressParts } from "../utils/addressFormat";
import type { AddressParts } from "../utils/addressFormat";

/**
 * ช่องกรอกที่อยู่แบบแยกช่อง (เลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์)
 * ใช้ทั้งใบสมัคร T000 และแบบฟอร์ม T002 — เดิมเป็นกล่องข้อความเดียว พิมพ์กันคนละแบบจนเอาไปใช้ต่อไม่ได้
 *
 * prefix = ชื่อนำหน้าช่องใน formData เช่น "contact" → contactAddrNo, contactMoo, ...
 * legacyValue = ที่อยู่เดิมที่เคยพิมพ์รวมไว้ แสดงให้ดูเพื่อกรอกลงช่องใหม่
 */
interface Props {
    form: Record<string, unknown>;
    prefix: string;
    onChange: (field: string, value: string) => void;
    legacyValue?: string | null;
    disabled?: boolean;
    inputStyle?: CSSProperties;
    labelStyle?: CSSProperties;
}

export default function AddressFields({ form, prefix, onChange, legacyValue, disabled, inputStyle, labelStyle }: Props) {
    const parts: AddressParts = readAddressParts(form, prefix);
    const preview = composeAddress(parts);
    const filled = hasAddressParts(parts);
    const legacy = String(legacyValue || "").trim();

    return (
        <div>
            {!filled && legacy && (
                <div style={legacyBox}>
                    ที่อยู่เดิมที่เคยบันทึกไว้: <b>{legacy}</b>
                    <div style={{ marginTop: 2 }}>กรุณากรอกลงช่องด้านล่างให้ครบ ระบบจะใช้ข้อมูลจากช่องใหม่แทน</div>
                </div>
            )}

            <div style={grid}>
                {ADDRESS_FIELDS.map((f) => {
                    const name = addressFieldName(prefix, f.key);
                    return (
                        <div key={name} style={f.key === "road" || f.key === "soi" ? { gridColumn: "span 1" } : undefined}>
                            <label htmlFor={name} style={{ ...defaultLabel, ...labelStyle }}>
                                {f.label}{f.required && <span style={{ color: "#dc2626" }}> *</span>}
                            </label>
                            <input
                                id={name}
                                name={name}
                                className="input"
                                value={(parts[f.key] as string) || ""}
                                onChange={(e) => onChange(name, e.target.value)}
                                disabled={disabled}
                                inputMode={f.key === "zipcode" ? "numeric" : undefined}
                                maxLength={f.key === "zipcode" ? 5 : 120}
                                style={{ width: "100%", boxSizing: "border-box", ...inputStyle }}
                            />
                        </div>
                    );
                })}
            </div>

            {preview && (
                <div style={previewBox}>
                    ที่อยู่ที่จะถูกนำไปใช้ในเอกสาร: <b>{preview}</b>
                </div>
            )}
        </div>
    );
}

const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
};
const defaultLabel: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 4,
};
const legacyBox: CSSProperties = {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 1.6,
};
const previewBox: CSSProperties = {
    marginTop: 8,
    fontSize: 12.5,
    color: "#475569",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "6px 10px",
};
