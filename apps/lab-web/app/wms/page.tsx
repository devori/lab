"use client";

import { useEffect, useMemo, useState } from "react";
import {
  emptyInventoryState,
  type InventoryState,
  type Location,
  type Movement,
  type MovementType,
  type Sku,
} from "@/lib/wms/inventory";
import { IndexedDbInventoryRepository } from "@/lib/wms/indexeddb-inventory-repository";

const repository = new IndexedDbInventoryRepository();

function createSampleState(): InventoryState {
  const now = new Date().toISOString();

  const sku: Sku = {
    id: crypto.randomUUID(),
    sku: "WMS-SAMPLE-001",
    name: "Sample SKU",
    createdAt: now,
  };

  const location: Location = {
    id: crypto.randomUUID(),
    zone: "A",
    bin: "A-01-01",
    createdAt: now,
  };

  const movement: Movement = {
    id: crypto.randomUUID(),
    sku: sku.sku,
    locationId: location.id,
    type: "ADJUST",
    quantity: 100,
    note: "seed",
    createdAt: now,
  };

  return {
    skus: [sku],
    locations: [location],
    movements: [movement],
  };
}

function locationLabel(loc: Location) {
  return `${loc.zone}-${loc.bin}`;
}

function computeStock(movements: Movement[]): Map<string, number> {
  const map = new Map<string, number>();

  const asc = [...movements].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const m of asc) {
    const key = `${m.sku}::${m.locationId}`;
    const current = map.get(key) ?? 0;

    if (m.type === "IN") {
      map.set(key, current + m.quantity);
      continue;
    }

    if (m.type === "OUT") {
      map.set(key, current - m.quantity);
      continue;
    }

    map.set(key, Math.max(0, m.quantity));
  }

  return map;
}

export default function Home() {
  const [state, setState] = useState<InventoryState>(emptyInventoryState);
  const [ready, setReady] = useState(false);

  const [skuCode, setSkuCode] = useState("");
  const [skuName, setSkuName] = useState("");
  const [zone, setZone] = useState("A");
  const [bin, setBin] = useState("");

  const [moveSku, setMoveSku] = useState("");
  const [moveLocationId, setMoveLocationId] = useState("");
  const [moveType, setMoveType] = useState<MovementType>("IN");
  const [moveQty, setMoveQty] = useState("1");
  const [moveNote, setMoveNote] = useState("");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const loaded = await repository.load();
        if (!mounted) return;
        setState(loaded);
        setMoveSku(loaded.skus[0]?.sku ?? "");
        setMoveLocationId(loaded.locations[0]?.id ?? "");
      } catch (error) {
        console.error("Failed to load inventory state", error);
        if (!mounted) return;
        setNotice("데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      } finally {
        if (!mounted) return;
        setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    void (async () => {
      try {
        await repository.save(state);
      } catch (error) {
        console.error("Failed to save inventory state", error);
        setNotice("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    })();
  }, [state, ready]);

  const stats = useMemo(
    () => ({
      skuCount: state.skus.length,
      locationCount: state.locations.length,
      movementCount: state.movements.length,
    }),
    [state]
  );

  const stockMap = useMemo(() => computeStock(state.movements), [state.movements]);

  const stockRows = useMemo(() => {
    return state.skus.flatMap((s) => {
      return state.locations.map((l) => {
        const key = `${s.sku}::${l.id}`;
        return {
          sku: s.sku,
          name: s.name,
          location: locationLabel(l),
          qty: stockMap.get(key) ?? 0,
        };
      });
    });
  }, [state.skus, state.locations, stockMap]);

  function onAddSku() {
    const code = skuCode.trim().toUpperCase();
    const name = skuName.trim();
    if (!code || !name) {
      setNotice("SKU와 품목명은 필수입니다.");
      return;
    }
    if (state.skus.some((s) => s.sku === code)) {
      setNotice("이미 존재하는 SKU입니다.");
      return;
    }

    const item: Sku = {
      id: crypto.randomUUID(),
      sku: code,
      name,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, skus: [item, ...prev.skus] }));
    setMoveSku(code);
    setSkuCode("");
    setSkuName("");
    setNotice("SKU가 추가되었습니다.");
  }

  function onAddLocation() {
    const z = zone.trim().toUpperCase() || "A";
    const b = bin.trim().toUpperCase();
    if (!b) {
      setNotice("Bin 값은 필수입니다.");
      return;
    }

    const zonePattern = /^[A-Z0-9]{1,3}$/;
    const binPattern = /^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$/;

    if (!zonePattern.test(z)) {
      setNotice("Zone 형식 오류: 영문/숫자 1~3자 (예: A, B1)");
      return;
    }

    if (!binPattern.test(b)) {
      setNotice("Bin 형식 오류: 2~4자-2~4자 (예: 01-01, A1-02)");
      return;
    }

    if (state.locations.some((l) => l.zone === z && l.bin === b)) {
      setNotice("이미 존재하는 로케이션입니다.");
      return;
    }

    const loc: Location = {
      id: crypto.randomUUID(),
      zone: z,
      bin: b,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, locations: [loc, ...prev.locations] }));
    setMoveLocationId(loc.id);
    setBin("");
    setNotice("로케이션이 추가되었습니다.");
  }

  function onAddMovement() {
    if (!moveSku || !moveLocationId) {
      setNotice("SKU와 로케이션을 먼저 선택해주세요.");
      return;
    }

    const parsedQty = Number(moveQty);
    if (!Number.isFinite(parsedQty) || !Number.isInteger(parsedQty)) {
      setNotice("수량은 정수로 입력해주세요.");
      return;
    }

    if (moveType === "ADJUST" && parsedQty < 0) {
      setNotice("ADJUST 수량은 0 이상이어야 합니다.");
      return;
    }

    if ((moveType === "IN" || moveType === "OUT") && parsedQty < 1) {
      setNotice(`${moveType} 수량은 1 이상이어야 합니다.`);
      return;
    }

    const qty = parsedQty;

    const key = `${moveSku}::${moveLocationId}`;
    const currentStock = stockMap.get(key) ?? 0;
    if (!allowNegativeStock && moveType === "OUT" && qty > currentStock) {
      setNotice(`출고 실패: 현재고(${currentStock})보다 큰 수량(${qty})입니다.`);
      return;
    }

    const movement: Movement = {
      id: crypto.randomUUID(),
      sku: moveSku,
      locationId: moveLocationId,
      type: moveType,
      quantity: qty,
      note: moveNote.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, movements: [movement, ...prev.movements].slice(0, 1000) }));
    setMoveQty("1");
    setMoveNote("");
    setNotice("이동이 반영되었습니다.");
  }

  async function onSeed() {
    const sample = createSampleState();
    setState(sample);
    setMoveSku(sample.skus[0]?.sku ?? "");
    setMoveLocationId(sample.locations[0]?.id ?? "");
    setNotice("샘플 데이터를 적용했습니다.");
  }

  async function onClear() {
    await repository.clear();
    setState(emptyInventoryState);
    setMoveSku("");
    setMoveLocationId("");
    setNotice("데이터를 초기화했습니다.");
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#f8fafc" }}>
      <section style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 14 }}>
        <header style={panelStyle}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>WMS P0 Bootstrap</h1>
          <p style={{ marginTop: 10, color: "#4b5563" }}>
            SKU/로케이션/재고이동 최소 기능 + IndexedDB 영속 저장 검증
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onSeed} style={secondaryBtn}>샘플 데이터 생성</button>
            <button onClick={onClear} style={secondaryBtn}>데이터 초기화</button>
            <label style={{ fontSize: 13, color: "#374151", display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={allowNegativeStock}
                onChange={(e) => setAllowNegativeStock(e.target.checked)}
              />
              음수 재고 허용
            </label>
          </div>
          {notice ? (
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "#1f2937" }}>{notice}</p>
          ) : null}
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
          <StatCard label="SKUs" value={stats.skuCount} />
          <StatCard label="Locations" value={stats.locationCount} />
          <StatCard label="Movements" value={stats.movementCount} />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={panelStyle}>
            <h3 style={h3}>SKU 추가</h3>
            <input style={inputStyle} value={skuCode} onChange={(e) => setSkuCode(e.target.value)} placeholder="WMS-001" />
            <input style={{ ...inputStyle, marginTop: 8 }} value={skuName} onChange={(e) => setSkuName(e.target.value)} placeholder="품목명" />
            <button onClick={onAddSku} style={primaryBtn}>SKU 저장</button>
          </div>

          <div style={panelStyle}>
            <h3 style={h3}>로케이션 추가</h3>
            <input style={inputStyle} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="A" />
            <input style={{ ...inputStyle, marginTop: 8 }} value={bin} onChange={(e) => setBin(e.target.value)} placeholder="01-01" />
            <button onClick={onAddLocation} style={primaryBtn}>로케이션 저장</button>
          </div>

          <div style={panelStyle}>
            <h3 style={h3}>재고 이동</h3>
            <select style={inputStyle} value={moveSku} onChange={(e) => setMoveSku(e.target.value)}>
              <option value="">SKU 선택</option>
              {state.skus.map((s) => (
                <option key={s.id} value={s.sku}>{s.sku} · {s.name}</option>
              ))}
            </select>
            <select
              style={{ ...inputStyle, marginTop: 8 }}
              value={moveLocationId}
              onChange={(e) => setMoveLocationId(e.target.value)}
            >
              <option value="">로케이션 선택</option>
              {state.locations.map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <select style={{ ...inputStyle, marginTop: 0 }} value={moveType} onChange={(e) => setMoveType(e.target.value as MovementType)}>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                <option value="ADJUST">ADJUST</option>
              </select>
              <input
                style={{ ...inputStyle, marginTop: 0 }}
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                type="number"
                min={moveType === "ADJUST" ? 0 : 1}
                step={1}
              />
            </div>
            <input style={{ ...inputStyle, marginTop: 8 }} value={moveNote} onChange={(e) => setMoveNote(e.target.value)} placeholder="메모" />
            <button onClick={onAddMovement} style={primaryBtn}>이동 반영</button>
          </div>
        </section>

        <section style={panelStyle}>
          <h3 style={h3}>현재고 (SKU + 로케이션)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                <th>SKU</th>
                <th>품목명</th>
                <th>로케이션</th>
                <th>수량</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r) => (
                <tr key={`${r.sku}-${r.location}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td>{r.sku}</td>
                  <td>{r.name}</td>
                  <td>{r.location}</td>
                  <td>{r.qty}</td>
                </tr>
              ))}
              {stockRows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ paddingTop: 8, color: "#6b7280" }}>데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section style={panelStyle}>
          <h3 style={h3}>최근 이동 로그</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                <th>시간</th>
                <th>SKU</th>
                <th>로케이션</th>
                <th>유형</th>
                <th>수량</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {state.movements.slice(0, 20).map((m) => {
                const loc = state.locations.find((l) => l.id === m.locationId);
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td>{new Date(m.createdAt).toLocaleString("ko-KR")}</td>
                    <td>{m.sku}</td>
                    <td>{loc ? locationLabel(loc) : "-"}</td>
                    <td>{m.type}</td>
                    <td>{m.quantity}</td>
                    <td>{m.note || ""}</td>
                  </tr>
                );
              })}
              {state.movements.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ paddingTop: 8, color: "#6b7280" }}>이동 로그가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
          상태: {ready ? "ready" : "loading..."} / 새로고침 후 데이터 유지되면 저장소 연결 정상
        </p>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
      <div style={{ color: "#6b7280", fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const h3: React.CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "8px 10px",
};

const primaryBtn: React.CSSProperties = {
  border: 0,
  background: "#111827",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 8,
  width: "100%",
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};
