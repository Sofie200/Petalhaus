import { Link } from "react-router-dom";
import Login from "./Login";
import CartIcon from "./CartIcon";


const Header = () => {

    return (
        <>
            <div className="container">

                <div className="logo">
                    <Link to="/"><span className="logo-main">Petal</span><span className="logo-accent">haus</span></Link>
                </div>

                <div className="right">
                    <CartIcon />
                    <Login />
                </div>

            </div>

        </>
    )
}

export default Header
