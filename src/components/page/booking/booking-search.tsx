'use client';

import DateRangeField from "@/components/shared/form/control/date-range-field";
import DefaultSearchForm from "@/components/shared/form/ui/default-search-form";
import FieldInline from "@/components/shared/form/ui/field-inline";
import FormSearch from "@/components/shared/form/ui/form-search";
import { Button, Checkbox, Form, Input, Select } from "antd";
import { useForm } from "antd/lib/form/Form";
import { RotateCcw, Search } from "lucide-react"; // 아이콘 추가
import { useRouter } from "next/router";
import React, { useCallback } from "react";

// 진단 신청 상태 옵션
const statusOptions = [
  { label: "대기중", value: "PENDING" },
  { label: "진단사배정", value: "ASSIGNED" },
  { label: "진단완료", value: "COMPLETED" },
  { label: "신청취소", value: "CANCELLED" },
];

const BookingSearch = () => {
  const [form] = useForm();
  const router = useRouter();

  // 검색 버튼 클릭 시 URL 쿼리 파라미터 업데이트
  const handleFinish = useCallback(
    (formValue: any) => {
      router.push({
        pathname: router.pathname,
        query: { ...router.query, ...formValue },
      });
    },
    [router]
  );

  return (
    <DefaultSearchForm form={form} onFinish={handleFinish}>
      <FormSearch>
        {/* 1. 기간 검색 */}
        <FieldInline>
          <Form.Item label="신청일자" name="searchDateType" initialValue="createdAt">
            <Select dropdownMatchSelectWidth={false}>
              <Select.Option value="createdAt">접수일자</Select.Option>
              <Select.Option value="preferredDate">진단희망일</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="searchDatePeriod">
            <DateRangeField />
          </Form.Item>
        </FieldInline>

        {/* 2. 진행 상태 필터 */}
        <div>
          <Form.Item name="status" label="진행상태">
            <Checkbox.Group options={statusOptions} />
          </Form.Item>
        </div>

        {/* 3. 상세 검색 조건 */}
        <div>
          <FieldInline>
            <Form.Item label="검색조건" name="searchType" initialValue="carNumber">
              <Select dropdownMatchSelectWidth={false}>
                <Select.Option value="carNumber">차량번호</Select.Option>
                <Select.Option value="dealerName">딜러명/상사명</Select.Option>
                <Select.Option value="contact">연락처</Select.Option>
                <Select.Option value="carOwner">차주성함</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="searchText" className="grow">
              <Input placeholder="검색어를 입력해주세요" allowClear />
            </Form.Item>
          </FieldInline>
        </div>

        {/* 4. 메모 검색 (선택 사항) */}
        <div>
          <Form.Item name="adminMemo" label="관리자 메모">
            <Input placeholder="메모 내용으로 검색" />
          </Form.Item>
        </div>
      </FormSearch>

      {/* 하단 버튼 영역 */}
      <div className="flex justify-center gap-2 mt-4">
        <Button
          type="primary"
          htmlType="submit"
          className="flex items-center gap-2"
          icon={<Search size={16} />}
        >
          조회하기
        </Button>
        <Button
          onClick={() => {
            form.resetFields();
            router.push(router.pathname); // 쿼리 초기화
          }}
          className="flex items-center gap-2"
          icon={<RotateCcw size={16} />}
        >
          초기화
        </Button>
      </div>
    </DefaultSearchForm>
  );
};

export default React.memo(BookingSearch);