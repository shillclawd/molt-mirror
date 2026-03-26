import { loadConfig } from "../config.js";
import { MemoryStore } from "../memory/sqlite.js";

const config = loadConfig();
const memory = new MemoryStore(config.dbPath);
memory.reset();
memory.close();
console.log("🗑️  Memory cleared. Next observation will be #1.");
