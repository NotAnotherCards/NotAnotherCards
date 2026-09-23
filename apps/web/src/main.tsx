import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';
import './lib/i18n';
const rootElement = document.getElementById('app')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
