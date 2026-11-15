'use client';

// 매물 옵션 선택 — antd Form.Item 안에서 쓰는 컨트롤.
//
// 값은 선택된 옵션 이름 배열(store_items.options)이다. Select 대신 칩 토글로 둔 이유는
// 50개가 넘는 항목을 드롭다운에서 고르면 뭘 골랐는지 한눈에 안 보이기 때문이다.
//
// ⚠ 목록에 없는 이름(예전 데이터·직접 입력)은 버리지 않고 "기타"로 같이 보여준다.
// 안 그러면 저장하는 순간 조용히 사라진다.

import { Tag } from "antd";
import { ALL_CAR_OPTIONS, CAR_OPTION_GROUPS } from "@/lib/carOptions";

export default function OptionPicker({
  value,
  onChange,
}: {
  value?: string[];
  onChange?: (next: string[]) => void;
}) {
  const selected = value ?? [];
  const known = new Set(ALL_CAR_OPTIONS);
  const etc = selected.filter(o => !known.has(o));

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter(v => v !== opt)
      : [...selected, opt];
    onChange?.(next);
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">
        해당하는 것만 누르세요. 선택 <span className="font-bold text-blue-600">{selected.length}</span>개
      </p>

      {CAR_OPTION_GROUPS.map(g => (
        <div key={g.key} className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">{g.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.options.map(opt => {
              const on = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={[
                    "text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                    on
                      ? "border-blue-500 bg-blue-50 text-blue-600 font-semibold"
                      : "border-gray-200 text-gray-500 hover:border-gray-300",
                  ].join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {etc.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">
            기타 <span className="font-normal text-gray-300">(목록에 없는 값 — 누르면 삭제됩니다)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {etc.map(opt => (
              <Tag key={opt} closable onClose={() => toggle(opt)} color="default">
                {opt}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
