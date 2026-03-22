'use client';

import { Button, Card, Checkbox, DatePicker, Input, Select, Space } from "antd";
import { RotateCcw, Search } from "lucide-react";

const { RangePicker } = DatePicker;

const DriverSearch = () => {
  return (
    <Card className="shadow-sm border-slate-100 mb-2">
      <div className="flex flex-col gap-4">
        {/* 등록일자 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">등록일자:</span>
          <RangePicker className="w-72" />
          <Space>
            <Button size="small">오늘</Button>
            <Button size="small">1주일</Button>
            <Button size="small">1개월</Button>
          </Space>
        </div>

        {/* 진행상태 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">계정상태:</span>
          <Checkbox.Group options={[
            { label: '대기(승인전)', value: 'PENDING' },
            { label: '활동중', value: 'ACTIVE' },
            { label: '정지', value: 'BANNED' }
          ]} />
        </div>

        {/* 검색조건 라인 */}
        <div className="flex items-center gap-4">
          <span className="w-24 font-bold text-gray-600">검색조건:</span>
          <Select defaultValue="name" style={{ width: 120 }}>
            <Select.Option value="name">성함</Select.Option>
            <Select.Option value="accountId">아이디</Select.Option>
            <Select.Option value="phone">연락처</Select.Option>
          </Select>
          <Input placeholder="검색어를 입력해주세요" style={{ width: 400 }} />
        </div>

        {/* 하단 버튼 영역 */}
        <div className="flex justify-center mt-4 gap-2 border-t pt-4">
          <Button type="primary" icon={<Search size={16} />} className="bg-indigo-600 h-10 px-10">
            조회하기
          </Button>
          <Button icon={<RotateCcw size={16} />} className="h-10 px-10">
            초기화
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default DriverSearch;