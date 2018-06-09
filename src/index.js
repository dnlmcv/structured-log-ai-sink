class ApplicationInsightsSink {

  url = 'https://dc.services.visualstudio.com/v2/track';
  instrumentationKey = null;
  durable = false;
  levelSwitch = null;
  refreshLevelSwitchTimeoutId = null;
  refreshLevelSwitchTimeoutInterval = 2 * 60 * 1000;

  constructor(options) {
    if (!options) {
      throw new Error(`'options' parameter is required.`);
    }

    this.url = this.url.replace(/\/$/, '');
    this.instrumentationKey = options.instrumentationKey;
    this.levelSwitch = options.levelSwitch || null;

    if (options.durable && typeof localStorage === 'undefined') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`'options.durable' parameter was set to true, but 'localStorage' is not available.`);
      }
      this.durable = false;
    } else {
      this.durable = !!options.durable;
    }

    if (this.durable) {
      const requests = {};
      for (let i = 0; i < localStorage.length; ++i) {
        const storageKey = localStorage.key(i);
        if (storageKey.indexOf('structured-log-ai-sink') !== 0) {
          continue;
        }

        const body = localStorage.getItem(storageKey);
        requests[storageKey] = this.postToApplicationInsights(this.url, body);
      }
      for (const k in requests) {
        if (requests.hasOwnProperty(k)) {
          requests[k].then(() => localStorage.removeItem(k));
        }
      }
    }

    if (this.levelSwitch !== null) {
      this.refreshLevelSwitchTimeoutId = setTimeout(() => this.sendToServer([]), this.refreshLevelSwitchTimeoutInterval);
    }
  }

  toString() {
    return 'ApplicationInsightsSink';
  }

  emit(events, done) {
    var filteredEvents = this.levelSwitch ?
      events.filter(e => this.levelSwitch.isEnabled(e.level)) :
      events;

    if (!filteredEvents.length) {
      return done ?
        Promise.resolve().then(() => done(null)) :
        Promise.resolve();
    }

    return this.sendToServer(filteredEvents, done);
  }

  sendToServer(events, done) {
    const body = events.map(e => {
      var event = this.mapLogLevel(e.level) == 'Trace' ? this.createTraceTelemetry(e.messageTemplate.raw,
          e.properties, e.timestamp) :
        this.createExceptionTelemetry(e.messageTemplate.raw, e.properties, e.timestamp);
      return event;
    });


    let storageKey;
    if (this.durable) {
      storageKey =
        `structured-log-applicationInsights-sink-${new Date().getTime()}-${Math.floor(Math.random() * 1000000) + 1}`;
      localStorage.setItem(storageKey, body);
    }

    const promise = this.postToApplicationInsights(this.url, body, done);

    var responsePromise = promise
      .then(r => r.json())
      .then(json => this.updateLogLevel(json));

    return storageKey ?
      responsePromise.then(() => localStorage.removeItem(storageKey)) :
      responsePromise;
  }

  updateLogLevel(response) {
    if (!this.levelSwitch) return;

    if (this.refreshLevelSwitchTimeoutId) {
      clearTimeout(this.refreshLevelSwitchTimeoutId);
      this.refreshLevelSwitchTimeoutId = setTimeout(() => this.sendToServer([]), this.refreshLevelSwitchTimeoutInterval);
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

  flush() {
    return Promise.resolve();
  }

  createTraceTelemetry(message, properties, timestamp) {
    return {
      name: `Microsoft.ApplicationInsights.${this.instrumentationKey}.Message`,
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

  createExceptionTelemetry(message, properties, timestamp) {
    return {
      name: `Microsoft.ApplicationInsights.${this.instrumentationKey}.Exception`,
      time: timestamp,
      iKey: this.instrumentationKey,
      data: {
        baseType: 'ExceptionData',
        baseData: {
          exceptions: [{
            hasFullStack: false,
            typeName: 'Error',
            message
          }],
          properties: properties
        }
      }
    };
  }

  postToApplicationInsights(url, body, done) {
    const promise = fetch(`${url}`, {
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify(body)
    });

    return !done ? promise : promise.then(response => done(response));
  }

  mapLogLevel(logLevel) {
    // If the log level isn't numeric (structured-log < 0.1.0), return it as-is.
    if (isNaN(logLevel)) {
      return logLevel;
    }
    // Parse bitfield log level (structured-log >= 0.1.0-alpha).
    if (logLevel === 1) {
      return 'Trace'
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
}

export default function applicationInsightsSinkFactory(options) {
  return new ApplicationInsightsSink(options);
}
