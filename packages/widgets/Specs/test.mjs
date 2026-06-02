import { createCommand } from "@vcmap-cesium/widgets";
import assert from "node:assert";

// NodeJS smoke screen test

const testFunc = () => {};

const command = createCommand(testFunc, true);
assert(command.canExecute === true);
