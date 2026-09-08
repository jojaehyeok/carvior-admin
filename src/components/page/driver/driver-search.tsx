'use client';

import { Button, Card, Checkbox, DatePicker, Input, Select, Space } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { RotateCcw, Search } from "lucide-react";
import { useState } from "react";

const { RangePicker } = DatePicker;

export type DriverSearchField = 'name' | 'accountId' | 'phone' | 'carNumber';

export interface IDriverFilters {
  /** 등록일 시작·종료 (YYYY-MM-DD, 양쪽 포함) */
  from: string | null;
  to: string | null;
  /** 체크된 계정상태. 비어 있으면 전체 */
  statuses: string[];
  field: DriverSearchField;
  keyword: string;
}

export const EMPTY_DRIVER_FILTERS: IDriverFilters = {
  from: null,
  to: null,
  statuses: [],
  field: 'name',
  keyword: '',
};

// 화면에 노출하는 계정상태. 서버가 실제로 넣는 값은 PENDING/APPROVED/REJECTED이고
// ACTIVE/BANNED는 예전 데이터에 남아 있어서, "승인완료"로 ACTIVE까지 함께 걸러준다
// (driver-list.tsx의 필터링 참고 — 상태 태그 색상표와 같은 값들이다).
const STATUS_OPTIONS = [
  { label: '승인대기', value: 'PENDING' },
  { label: '승인완료', value: 'APPROVED' },
  { label: '활동정지', value: 'BANNED' },
  { label: '거절됨', value: 'REJECTED' },
];

interface Props {
  /** [조회하기]를 눌렀을 때만 부모로 올라간다 — 타이핑 중에 목록이 흔들리지 않게 */
  onSearch: (filters: IDriverFilters) => void;
}

const DriverSearch = ({ onSearch }: Props) => {
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [field, setField] = useState<DriverSearchField>('name');
  const [keyword, setKeyword] = useState('');

  const quickRange = (days: number) => setRange([dayjs().subtract(days, 'day'), dayjs()]);

  const submit = () => {
    onSearch({
      from: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
      to: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
      statuses,
      field,
      keyword: keyword.trim(),
    });
  };

  const reset = () => {
    setRange(null);
    setStatuses([]);
    setField('name');
    setKeyword('');
    onSearch(EMPTY_DRIVER_FILTERS);
  };

  return (
    <Card className="shadow-sm border-slate-100 mb-2">
      <div className="flex flex-col gap-4">
        {/* 등록일자 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">등록일자:</span>
          <RangePicker
            className="w-72"
            value={range}
            onChange={(v) => setRange(v as [Dayjs | null, Dayjs | null] | null)}
          />
          <Space>
            <Button size="small" onClick={() => quickRange(0)}>오늘</Button>
            <Button size="small" onClick={() => quickRange(7)}>1주일</Button>
            <Button size="small" onClick={() => quickRange(30)}>1개월</Button>
          </Space>
        </div>

        {/* 진행상태 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">계정상태:</span>
          <Checkbox.Group
            options={STATUS_OPTIONS}
            value={statuses}
            onChange={(v) => setStatuses(v as string[])}
          />
        </div>

        {/* 검색조건 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">검색조건:</span>
          <Select<DriverSearchField> value={field} onChange={setField} style={{ width: 120 }}>
            <Select.Option value="name">성함</Select.Option>
            <Select.Option value="accountId">아이디</Select.Option>
            <Select.Option value="phone">연락처</Select.Option>
            <Select.Option value="carNumber">평가 차량</Select.Option>
          </Select>
          <Input
            placeholder="검색어를 입력해주세요"
            style={{ width: 400 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={submit}
            allowClear
          />
        </div>

        {/* 하단 버튼 영역 */}
        <div className="flex justify-center mt-4 gap-2 border-t pt-4">
          <Button type="primary" icon={<Search size={16} />} className="bg-indigo-600 h-10 px-10" onClick={submit}>
            조회하기
          </Button>
          <Button icon={<RotateCcw size={16} />} className="h-10 px-10" onClick={reset}>
            초기화
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default DriverSearch;
