import { useState } from "react";

export type CoopSitesProps = {
  sites: { id: string; name: string; address: string; email: string; phone: string }[];
  setSites: React.Dispatch<React.SetStateAction<CoopSitesProps["sites"]>>;
}

export default function CoopSites(props: CoopSitesProps) {
  const { sites, setSites } = props;
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
  });

  const addSite = () => {
    setSites((prev) => [...prev, { id: Date.now().toString(), ...form }]);
    setForm({ name: "", address: "", email: "", phone: "" });
    setAdding(false);
  };

  const filtered = sites.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">สถานฝึกสหกิจ</h2>
        <div className="flex items-center gap-2">
          <input
            className="border p-2 rounded"
            placeholder="ค้นหาสถานฝึก"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => setAdding(!adding)}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            เพิ่มสถานฝึก
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-white p-4 border rounded mb-4">
          <label className="block text-sm">ชื่อ</label>
          <input
            className="border p-2 w-full rounded mb-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="block text-sm">ที่อยู่</label>
          <input
            className="border p-2 w-full rounded mb-2"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <label className="block text-sm">อีเมล</label>
          <input
            className="border p-2 w-full rounded mb-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <label className="block text-sm">โทร</label>
          <input
            className="border p-2 w-full rounded mb-2"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="pt-2">
            <button
              onClick={addSite}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              บันทึก
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => (
          <div key={s.id} className="bg-white p-4 border rounded">
            <h3 className="font-medium">{s.name}</h3>
            <p className="text-sm text-gray-500">{s.address}</p>
            <p className="text-sm">
              {s.email} • {s.phone}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
