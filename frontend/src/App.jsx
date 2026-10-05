import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from 'react';
import { ShoppingCartProvider } from './contexts/ShoppingCart';
import { CurrencyProvider } from './contexts/CurrencyContext';
import Footer from './components/Footer'
import Header from './components/Header'
import Nav from './components/Nav';
import Products from './pages/Products'
import Product from "./pages/Product";
import Cart from './pages/Cart';
import ManageProduct from './pages/admin/ManageProduct';
import AddProduct from './pages/admin/AddProduct';
import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import ManageOrders from './pages/admin/ManageOrders';
import Unauthorized from './pages/Unauthorized'
import ProtectedRoute from './components/admin/ProtectedRoute';

function App() {
	const [rates, setRates] = useState(0);
	const API_URL = import.meta.env.VITE_API_URL;


	useEffect(() => {
		fetch(`${API_URL}/currency/rates`)
			.then(response => response.json())
			.then((data) => {
				console.log("hej");
				console.log(data)
				setRates(data.rates)
			})
	}, []);

	return (
		<CurrencyProvider>
			<ShoppingCartProvider>
				<BrowserRouter>
					<main>

						<Header />
						<div>
							<Nav />
							<Routes>
								<Route path="/" element={<Products />} />
								<Route path="/product/:id" element={<Product />} />
								<Route path="/cart" element={<Cart />} />
								<Route path="/checkout" element={<Checkout />} />
								<Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
								<Route path="/unauthorized" element={<Unauthorized />} />
								<Route path="/admin/add-product/" element={<ProtectedRoute role={"admin"}><AddProduct /></ProtectedRoute>} />
								<Route path="/admin/manage-product/:id" element={<ProtectedRoute role={"admin"}><ManageProduct /></ProtectedRoute>} />
								<Route path="/admin/manage-orders" element={<ProtectedRoute role={"admin"}><ManageOrders /></ProtectedRoute>} />
							</Routes>
						</div>
					</main>
					<Footer />
				</BrowserRouter>
			</ShoppingCartProvider>
		</CurrencyProvider>
	)
}

export default App