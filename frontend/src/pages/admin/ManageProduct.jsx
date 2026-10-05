import { useState, useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import useProduct from "../../hooks/useProduct";
import ManageProductForm from "../../components/admin/ManageProductForm"

export default function ManageProduct() {

    const { id } = useParams();
    const [name, setName] = useState(null);
    const { product, loading } = useProduct();

    useEffect(() => {
        if (product) {
            console.log(product);
            setName(product.name);
        }
    },[product]);

    if(loading){
        return;
    }

    return (
        
        <div>
            <div className="breadcrumb">
                <Link to={`/`}>Produkter</Link>
                &nbsp;&gt;&nbsp;
                <Link to={`/product/${id}`}>{name}</Link>
                &nbsp;&gt;&nbsp;Hantera
            </div>

            <h3>Redigera produkt</h3>

            <ManageProductForm type={"edit"} product={product} />

        </div>
    )
}