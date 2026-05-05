# @vcmap-cesium/widgets

> > **_Attention_**
>
> This is a custom CesiumJS fork to be used with the `VC Map`.
> For the common CesiumJS module visit [this package](https://www.npmjs.com/package/@vcmap-cesium/widgets).

---

[![Build Status](https://github.com/CesiumGS/cesium/actions/workflows/dev.yml/badge.svg)](https://github.com/CesiumGS/cesium/actions/workflows/dev.yml)
[![npm](https://img.shields.io/npm/v/@vcmap-cesium/widgets)](https://www.npmjs.com/package/@vcmap-cesium/widgets)
[![Docs](https://img.shields.io/badge/docs-online-orange.svg)](https://cesium.com/learn/)

![Cesium](https://github.com/CesiumGS/cesium/wiki/logos/Cesium_Logo_Color.jpg)

[CesiumJS](../../README.md) is a JavaScript library for creating 3D globes and 2D maps in a web browser without a plugin. It uses WebGL for hardware-accelerated graphics, and is cross-platform, cross-browser, and tuned for dynamic-data visualization.

`@vcmap-cesium/widgets` is a widgets library for use with CesiumJS—including the `CesiumViewer` widget plus widgets for common tasks such as animation, base layer selection and geocoding.

---

[**Examples**](https://sandcastle.cesium.com/) :earth_asia: [**Docs**](https://cesium.com/learn/cesiumjs-learn/) :earth_americas: [**Website**](https://cesium.com/cesiumjs) :earth_africa: [**Forum**](https://community.cesium.com/) :earth_asia: [**User Stories**](https://cesium.com/user-stories/)

---

## Install

`@vcmap-cesium/widgets` is published as ES modules with full typing support.

Install with npm

```sh
npm install @vcmap-cesium/widgets --save
```

Or, install with yarn

```sh
yarn add @vcmap-cesium/widgets
```

## Usage

Import individual modules to benefit from tree shaking optimizations through most build tools:

```js
import { Viewer } from "@vcmap-cesium/widgets";
import "@vcmap-cesium/widgets/Source/widgets.css";

const viewer = new Viewer("cesiumContainer");
```

See our [Quickstart Guide](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/) for more information on getting a CesiumJS app up and running.

## Community

Have questions? Ask them on the [community forum](https://community.cesium.com/).

Interested in contributing? See [CONTRIBUTING.md](../../CONTRIBUTING.md). :heart:

## License

[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html). CesiumJS is free for both commercial and non-commercial use.
