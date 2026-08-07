import { DatePicker, Radio, RadioChangeEvent } from "antd";
import dayjs from "dayjs";
import React from "react";

interface IDateRangeFieldProps {
  value?: (dayjs.Dayjs | null)[];
  onChange?: (value: (dayjs.Dayjs | null)[]) => void;
  // "past"(기본): 오늘을 종료일에 고정하고 시작일이 과거로 이동 — 접수일자처럼 지난 기록을 조회할 때.
  // "future": 오늘을 시작일에 고정하고 종료일이 미래로 이동 — 진단희망일처럼 앞으로의 예약 일정을 조회할 때.
  direction?: "past" | "future";
}

const dateRangeOptions = [
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

const DateRangeField = ({ value, onChange, direction = "past" }: IDateRangeFieldProps) => {
  const handleDateRangeChange = (e: RadioChangeEvent) => {
    const today = dayjs();
    if (e.target.value === "today") {
      onChange?.([today, today]);
      return;
    }
    const unit = DATE_RANGE_UNITS[e.target.value];
    if (!unit) return;
    const [amount, type] = unit;
    onChange?.(
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
