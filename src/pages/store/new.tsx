import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import ProductForm from "@/components/page/sample/product/product-form";

const pageHeader: IPageHeader = {
  title: "상품등록",
};

const ProductNewPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <ProductForm initialValues={{ status: "NOTSALE" }} />
    </RequireSuperAdmin>
  );
};

ProductNewPage.getLayout = getDefaultLayout;
ProductNewPage.pageHeader = pageHeader;

export default ProductNewPage;
