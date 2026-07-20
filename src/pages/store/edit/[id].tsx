import { useProduct } from "@/client/sample/product";
import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import ProductForm from "@/components/page/sample/product/product-form";
import { Alert, Skeleton } from "antd";
import { useRouter } from "next/router";

const pageHeader: IPageHeader = {
  title: "상품수정",
};

const ProductEditPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const { data, error, isLoading, isValidating } = useProduct(router.query.id as string);

  return (
    <RequireSuperAdmin>
      {error ? (
        <Alert message="데이터 로딩 중 오류가 발생했습니다." type="warning" className="my-5" />
      ) : !data || isLoading || isValidating ? (
        <Skeleton className="my-5" />
      ) : (
        <ProductForm id={router.query.id as string} initialValues={data.data} />
      )}
    </RequireSuperAdmin>
  );
};

ProductEditPage.getLayout = getDefaultLayout;
ProductEditPage.pageHeader = pageHeader;

export default ProductEditPage;
