import './style.css';
import { renderApp } from '@/ui/screens';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app container');
}

renderApp(root);
