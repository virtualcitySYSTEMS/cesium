import { createTaskProcessorWorker } from "@vcmap-cesium/engine";

export default createTaskProcessorWorker(function () {
  throw new Error("BadGeometry.createGeometry");
});
