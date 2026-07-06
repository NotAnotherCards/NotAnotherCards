import { createRoot } from "react-dom/client";
import "./style.css";
import typescriptLogo from "/typescript.svg";
import { Button } from "./components/ui/button";

const App = () => (
  <div className="flex gap-7">
    <h1 className="text-blue-500 text-3xl font-bold underline">Hello World</h1>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" className="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img
        src={typescriptLogo}
        className="logo vanilla"
        alt="TypeScript logo"
      />
    </a>
    <Button variant="outline">Test</Button>
  </div>
);

createRoot(document.getElementById("app")!).render(<App />);
