# structured-log-ai-sink

A [structured-log](https://github.com/structured-log/structured-log) plugin that writes log events to [Application Insights](https://azure.microsoft.com/en-us/services/application-insights/).

**Requires polyfills for `Promise` and `fetch` if those aren't supported in your target platform/browser.**

### Installation

```
npm i structured-log-ai-sink --save
```

### Usage

```js
var structuredLog = require('structured-log');
var aiSink = require('structured-log-ai-sink');

var logger = structuredLog.configure()
  .writeTo(new aiSink({ /* ... options ...  */ }))
  .create();

```

##### Available options

|Parameter|Description|
|---|---|
|`instrumentationKey`|(optional) API key to use|
|`durable`|(optional) If true, events will be buffered in local storage if available|
|`levelSwitch`|(optional) `DynamicLevelSwitch` which the Ai log level will control and use |

#### Dynamic Level Control

Much like [Serilog's Dynamic Level Control via Ai](http://docs.getseq.net/docs/using-serilog#dynamic-level-control), Ai can be used to dynamically
control the log level of `structured-log`.  To configure, setup a `DynamicLevelSwitch` and pass it to the sink:

```js
var levelSwitch = new structuredLog.DynamicLevelSwitch("info")
var log = structuredLog.configure()
    .minLevel(levelSwitch)
    .writeTo(new aiSink({
        instrumentationKey: "API_KEY",
        levelSwitch: levelSwitch
    }))
    .create();
```

This can be used as the log level across the entire pipeline (by using `.minLevel(levelSwitch)`, or just for the 
AI sink (by passing it in the `options` array).


### Building and testing

To build the modules yourself, check out the code, then install dependencies and run the `build` script:

```
npm i
npm run build
```

Then, you can test the bundled module by running:

```
npm test
```
