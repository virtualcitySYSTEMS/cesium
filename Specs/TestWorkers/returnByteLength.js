import { createTaskProcessorWorker } from "@vcmap-cesium/engine";

export default createTaskProcessorWorker(function (parameters) {
  return parameters.byteLength;
});
