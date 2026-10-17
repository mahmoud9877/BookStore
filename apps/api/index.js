import path from "path";
import express from "express";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import initApp from "./src/app.router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "./config/.env") });
const app = express();
const port = 3000;
initApp(app, express);
app.listen(port, () => console.log(`server is running............${port}`));
