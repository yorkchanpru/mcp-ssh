#!/usr/bin/env node

import { cli } from "./index.js";

// Check if we should use stdio transport
const useStdio = process.argv.includes("--stdio");

// Call CLI function with the appropriate parameters
cli(useStdio);
