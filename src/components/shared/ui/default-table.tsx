import { Table, TableProps } from "antd";
import numeral from "numeral";
import React, { PropsWithChildren } from "react";

interface IDefaultTableProps<T> extends TableProps<T> {
  countLabel?: number;
}

const DefaultTable = <T extends object>({
  children,
  countLabel,
  ...tableProps
}: PropsWithChildren<IDefaultTableProps<T>>) => {
  return (
    <Table<T>
      size="small"
      rowKey="id"
      tableLayout="fixed"
      scroll={{ x: 'max-content' }}
      bordered
      {...(countLabel && { title: () => <p>{numeral(countLabel).format("0,0")}건</p> })}
      {...tableProps}
    >
      {children}
    </Table>
  );
};

export default React.memo(DefaultTable) as typeof DefaultTable;
