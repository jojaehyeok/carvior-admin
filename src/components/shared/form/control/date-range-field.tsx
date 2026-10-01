import { DatePicker, Radio, RadioChangeEvent } from "antd";
import dayjs from "dayjs";
import React from "react";

interface IDateRangeFieldProps {
  value?: (dayjs.Dayjs | null)[];
  onChange?: (value: (dayjs.Dayjs | null)[]) => void;
  // "past"(기본): 오늘을 종료일에 고정하고 시작일이 과거로 이동 — 접수일자처럼 지난 기록을 조회할 때.
  // "future": 오늘을 시작일에 고정하고 종료일이 미래로 이동 — 진단희망일처럼 앞으로의 예약 일정을 조회할 때.
  direction?: "past" | "future";
  // 빠른 기간 버튼(전체/오늘/1주일…)을 눌렀을 때 호출 — 조회 버튼을 또 누르지 않아도
  // 바로 적용되게 하려고 쓴다. 날짜를 직접 고르는 경우엔 호출하지 않는다.
  onQuickSelect?: () => void;
}

const dateRangeOptions = [
  // 기간을 아예 안 거는 "전체" — 한 번 기간을 고른 뒤 다시 전체로 돌아오려면 초기화를
  // 눌러 다른 조건까지 날려야 했다.
  { label: "전체", value: "all" },
  { label: "오늘", value: "today" },
  { label: "1주일", value: "1week" },
  { label: "1개월", value: "1month" },
  { label: "3개월", value: "3months" },
  { label: "6개월", value: "6months" },
  { label: "1년", value: "1year" },
];

const DATE_RANGE_UNITS: Record<string, [number, dayjs.ManipulateType]> = {
  "1week": [1, "week"],
  "1month": [1, "month"],
  "3months": [3, "month"],
  "6months": [6, "month"],
  "1year": [1, "year"],
};

const DateRangeField = ({ value, onChange, direction = "past", onQuickSelect }: IDateRangeFieldProps) => {
  const handleDateRangeChange = (e: RadioChangeEvent) => {
    const today = dayjs();
    const apply = (next: (dayjs.Dayjs | null)[]) => {
      onChange?.(next);
      // onChange로 폼 값이 반영된 다음에 조회가 돌아야 해서 한 틱 미룬다.
      if (onQuickSelect) setTimeout(onQuickSelect, 0);
    };
    if (e.target.value === "all") {
      apply([null, null]);
      return;
    }
    if (e.target.value === "today") {
      apply([today, today]);
      return;
    }
    const unit = DATE_RANGE_UNITS[e.target.value];
    if (!unit) return;
    const [amount, type] = unit;
    apply(
      direction === "future"
        ? [today, today.add(amount, type)]
        : [today.subtract(amount, type), today]
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        placeholder="시작 날짜"
        onChange={(v: dayjs.Dayjs | null) => {
          onChange?.([v, value?.[1] || null]);
        }}
        value={value?.[0]}
      />
      <span>~</span>
      <DatePicker
        placeholder="종료 날짜"
        onChange={(v: dayjs.Dayjs | null) => {
          onChange?.([value?.[0] || null, v]);
        }}
        value={value?.[1]}
      />
      <div className="flex items-center gap-1">
        <Radio.Group
          size="small"
          options={dateRangeOptions}
          optionType="button"
          buttonStyle="solid"
          onChange={handleDateRangeChange}
        />
      </div>
    </div>
  );
};

export default React.memo(DateRangeField);
