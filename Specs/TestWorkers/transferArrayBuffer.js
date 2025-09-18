import { createTaskProcessorWorker } from "@vcmap-cesium/engine";

export default createTaskProcessorWorker(
  function (parameters, transferableObjects) {
    const arrayBuffer = new ArrayBuffer(parameters.byteLength);
    transferableObjects.push(arrayBuffer);
    return arrayBuffer;
  },
);
