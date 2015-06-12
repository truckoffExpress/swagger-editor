'use strict';

SwaggerEditor.service('Backend', function Backend($http, $q, defaults,
  Builder, ExternalHooks) {
  var changeListeners =  {};
  var absoluteRegex = /^(\/|http(s)?\:\/\/)/; // starts with slash or http|https
  var buffer = {};
  var throttleTimeout = defaults.backendThrottle || 200;
  var commit = _.throttle(commitNow, throttleTimeout, {
    leading: false,
    trailing: true
  });

  var backendEndpoint = defaults.backendEndpoint;

  // if backendEndpoint is not absolute append it to location.pathname
  if (!absoluteRegex.test(backendEndpoint)) {
    var pathname = _.endsWith(location.pathname, '/') ? location.pathname :
      location.pathname + '/';
    backendEndpoint = pathname + defaults.backendEndpoint;

    // avoid double slash that might generated by appending location.href to
    // backendEndpoint
    backendEndpoint = backendEndpoint.replace('//', '/');
  }

  /*
   *
  */
  function commitNow(data) {
    var result = Builder.buildDocs(data, { resolve: true });

    save('progress', 'progress-saving');

    if (!result.error) {
      $http.put(backendEndpoint, data)
        .then(function success() {
          ExternalHooks.trigger('put-success', [].slice.call(arguments));
          save('progress', 'success-saved');
        }, function failure() {
          ExternalHooks.trigger('put-failure', [].slice.call(arguments));
          save('progress', 'error-connection');
        });
    }
  }

  /*
   *
  */
  function save(key, value) {

    // Save values in a buffer
    buffer[key] = value;

    if (Array.isArray(changeListeners[key])) {
      changeListeners[key].forEach(function (fn) {
        fn(value);
      });
    }

    if (defaults.useYamlBackend && (key === 'yaml' && value)) {
      commit(value);
    } else if (key === 'specs' && value) {
      commit(buffer[key]);
    }

  }

  /*
   *
  */
  function load(key) {
    if (key !== 'yaml') {
      var deferred = $q.defer();
      if (!key) {
        deferred.reject();
      } else {
        deferred.resolve(buffer[key]);
      }
      return deferred.promise;
    }

    var httpConfig = {
      headers: {
        accept: defaults.useYamlBackend ?
          'application/yaml; charset=utf-8' :  'application/json; charset=utf-8'

      }
    }

    return $http.get(backendEndpoint, httpConfig)
      .then(function (res) {
        if (defaults.useYamlBackend) {
          buffer.yaml = res.data;
          return buffer.yaml;
        }
        return res.data;
      });
  }

  /*
   *
  */
  function addChangeListener(key, fn) {
    if (angular.isFunction(fn)) {
      if (!changeListeners[key]) {
        changeListeners[key] = [];
      }
      changeListeners[key].push(fn);
    }
  }

  /*
   *
  */
  function noop() {}

  this.save = save;
  this.reset = noop;
  this.load = load;
  this.addChangeListener = addChangeListener;
});