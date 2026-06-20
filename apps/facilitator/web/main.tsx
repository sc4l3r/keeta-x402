import "./app.css";
import { render } from "preact";
import { App } from "./app.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";

// Polyfill Buffer for libraries that expect it globally
(globalThis as any).Buffer = KeetaNet.lib.Utils.Buffer.Buffer;

const root = document.getElementById("app");
if (!root) throw new Error("Mount node #app not found");

render(<App />, root);
