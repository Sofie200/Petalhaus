import { StrictMode } from 'react'
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById("root")).render(
	<AuthProvider>
		<StrictMode>
			<App />
		</StrictMode>
	</AuthProvider>
)
