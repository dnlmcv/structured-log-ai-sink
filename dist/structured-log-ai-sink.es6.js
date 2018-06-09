var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ApplicationInsightsSink = function () {
  function ApplicationInsightsSink(options) {
    var _this = this;

    _classCallCheck(this, ApplicationInsightsSink);

    this.url = 'https://dc.services.visualstudio.com/v2/track';
    this.instrumentationKey = null;
    this.durable = false;
    this.levelSwitch = null;
    this.refreshLevelSwitchTimeoutId = null;
    this.refreshLevelSwitchTimeoutInterval = 2 * 60 * 1000;

    if (!options) {
      throw new Error('\'options\' parameter is required.');
    }

    this.url = this.url.replace(/\/$/, '');
    this.instrumentationKey = options.instrumentationKey;
    this.levelSwitch = options.levelSwitch || null;

    if (options.durable && typeof localStorage === 'undefined') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('\'options.durable\' parameter was set to true, but \'localStorage\' is not available.');
      }
      this.durable = false;
    } else {
      this.durable = !!options.durable;
    }

    if (this.durable) {
      var requests = {};
      for (var i = 0; i < localStorage.length; ++i) {
        var storageKey = localStorage.key(i);
        if (storageKey.indexOf('structured-log-ai-sink') !== 0) {
          continue;
        }

        var body = localStorage.getItem(storageKey);
        requests[storageKey] = this.postToApplicationInsights(this.url, body);
      }

      var _loop = function _loop(k) {
        if (requests.hasOwnProperty(k)) {
          requests[k].then(function () {
            return localStorage.removeItem(k);
          });
        }
      };

      for (var k in requests) {
        _loop(k);
      }
    }

    if (this.levelSwitch !== null) {
      this.refreshLevelSwitchTimeoutId = setTimeout(function () {
        return _this.sendToServer([]);
      }, this.refreshLevelSwitchTimeoutInterval);
    }
  }

  _createClass(ApplicationInsightsSink, [{
    key: 'toString',
    value: function toString() {
      return 'ApplicationInsightsSink';
    }
  }, {
    key: 'emit',
    value: function emit(events, done) {
      var _this2 = this;

      var filteredEvents = this.levelSwitch ? events.filter(function (e) {
        return _this2.levelSwitch.isEnabled(e.level);
      }) : events;

      if (!filteredEvents.length) {
        return done ? Promise.resolve().then(function () {
          return done(null);
        }) : Promise.resolve();
      }

      return this.sendToServer(filteredEvents, done);
    }
  }, {
    key: 'sendToServer',
    value: function sendToServer(events, done) {
      var _this3 = this;

      var body = events.map(function (e) {
        var event = _this3.mapLogLevel(e.level) == 'Trace' ? _this3.createTraceTelemetry(e.messageTemplate.raw, e.properties, e.timestamp) : _this3.createExceptionTelemetry(e.messageTemplate.raw, e.properties, e.timestamp);
        return event;
      });

      var storageKey = void 0;
      if (this.durable) {
        storageKey = 'structured-log-applicationInsights-sink-' + new Date().getTime() + '-' + (Math.floor(Math.random() * 1000000) + 1);
        localStorage.setItem(storageKey, body);
      }

      var promise = this.postToApplicationInsights(this.url, body, done);

      var responsePromise = promise.then(function (r) {
        return r.json();
      }).then(function (json) {
        return _this3.updateLogLevel(json);
      });

      return storageKey ? responsePromise.then(function () {
        return localStorage.removeItem(storageKey);
      }) : responsePromise;
    }
  }, {
    key: 'updateLogLevel',
    value: function updateLogLevel(response) {
      var _this4 = this;

      if (!this.levelSwitch) return;

      if (this.refreshLevelSwitchTimeoutId) {
        clearTimeout(this.refreshLevelSwitchTimeoutId);
        this.refreshLevelSwitchTimeoutId = setTimeout(function () {
          return _this4.sendToServer([]);
        }, this.refreshLevelSwitchTimeoutInterval);
      }

      if (response && response.MinimumLevelAccepted) {
        switch (response.MinimumLevelAccepted) {
          case 'Fatal':
            this.levelSwitch.fatal();
            break;
          case 'Error':
            this.levelSwitch.error();
            break;
          case 'Warning':
            this.levelSwitch.warning();
            break;
          case 'Information':
            this.levelSwitch.information();
            break;
          case 'Debug':
            this.levelSwitch.debug();
            break;
          case 'Verbose':
            this.levelSwitch.verbose();
            break;
        }
      }
    }
  }, {
    key: 'flush',
    value: function flush() {
      return Promise.resolve();
    }
  }, {
    key: 'createTraceTelemetry',
    value: function createTraceTelemetry(message, properties, timestamp) {
      return {
        name: 'Microsoft.ApplicationInsights.' + this.instrumentationKey + '.Message',
        time: timestamp,
        iKey: this.instrumentationKey,
        data: {
          baseType: 'MessageData',
          baseData: {
            message: message,
            properties: properties
          }
        }
      };
    }
  }, {
    key: 'createExceptionTelemetry',
    value: function createExceptionTelemetry(message, properties, timestamp) {
      return {
        name: 'Microsoft.ApplicationInsights.' + this.instrumentationKey + '.Exception',
        time: timestamp,
        iKey: this.instrumentationKey,
        data: {
          baseType: 'ExceptionData',
          baseData: {
            exceptions: [{
              hasFullStack: false,
              typeName: 'Error',
              message: message }],
            properties: properties
          } }
      };
    }
  }, {
    key: 'postToApplicationInsights',
    value: function postToApplicationInsights(url, body, done) {
      var promise = fetch('' + url, {
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(body)
      });

      return !done ? promise : promise.then(function (response) {
        return done(response);
      });
    }
  }, {
    key: 'mapLogLevel',
    value: function mapLogLevel(logLevel) {
      // If the log level isn't numeric (structured-log < 0.1.0), return it as-is.
      if (isNaN(logLevel)) {
        return logLevel;
      }

      // Parse bitfield log level (structured-log >= 0.1.0-alpha).
      if (logLevel === 1) {
        return 'Trace';
      } else if (logLevel === 3) {
        return 'Exception';
      } else if (logLevel === 7) {
        return 'Exception';
      } else if (logLevel === 31) {
        return 'Trace';
      } else if (logLevel === 63) {
        return 'Trace';
      }

      // Default to Information.
      return 'Information';
    }
  }]);

  return ApplicationInsightsSink;
}();

function applicationInsightsSinkFactory(options) {
  return new ApplicationInsightsSink(options);
}

export default applicationInsightsSinkFactory;
