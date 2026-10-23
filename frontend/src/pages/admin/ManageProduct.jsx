import { Link, useParams } from "react-router-dom";
import useProduct from "../../hooks/useProduct";
import ManageProductForm from "../../components/admin/ManageProductForm";
import Loading from "../../components/Loading";

export default function ManageProduct() {
    const { id } = useParams();
    const { product, loading } = useProduct();

    if (loading) return <Loading />;

    return (
        <div>
            <div className="breadcrumb">
                <Link to="/">Produkter</Link>
                &nbsp;&gt;&nbsp;
                <Link to={`/product/${id}`}>{product?.name}</Link>
                &nbsp;&gt;&nbsp;Hantera
            </div>

            <h3>Redigera produkt</h3>

            <ManageProductForm type="edit" />
        </div>
    );
}