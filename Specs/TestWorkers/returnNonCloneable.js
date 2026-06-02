import { createTaskProcessorWorker } from "@vcmap-cesium/engine";

export default createTaskProcessorWorker(function () {
  return function () {
    //functions are not cloneable
  };
});
