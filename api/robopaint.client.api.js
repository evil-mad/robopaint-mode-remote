/**
 * @file Holds all RoboPaint Remote API controller functions and RESTful
 * interactions, abstracted for use in a client side application. Includable as
 * DOM JS, requires jQuery.
 *
 * In use, must set the "server" object like the following:
 *
 * robopaint.api.server = {
 *   domain: 'localhost',
 *   port: 4242,
 *   protocol: 'http',
 *   version: '1'
 * }
 */

/*globals $ */

// Initialize wrapper object is this library is being used elsewhere
if (typeof robopaint === 'undefined') var robopaint = {};
if (typeof robopaint.api === 'undefined') robopaint.api = {};


(function(){
  /**
   * Restful API wrappers
   */
  robopaint.api.print = {
   /**
    * Get remote printing readiness status.
    *
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    status: function(callback){
      _get('print', {
        success: function(d){
          if (callback) callback(d);
        },
        error: function(e) {
          if (callback) callback(false, e);
        }
      });
    },

   /**
    * Set readiness for printing (required to process print queue)
    *
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    setReady: function(callback){
      _post('print', {
        data: {ready: true},
        success: function(d){
          if (callback) callback(d);
        },
        error: function(e) {
          if (callback) callback(false, e);
        }
      });
    },

    /**
    * Add an SVG to the queue (will begin to print immediately if state is
    * ready with no other items in print queue).
    *
    * @param {string} svg
    *   String of raw, valid, SVG XML content to be printed.
    * @param {object} options
    *   Object to be passed to the "options" key in the payload, see API docs
    *   for available options.
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    queueSVG: function(svg, options, callback){
      _post('print', {
        data: {options: options, svg: svg},
        success: function(d){
          if (callback) callback(d);
        },
        error: function(e) {
          if (callback) callback(false, e);
        }
      });
    },

   /**
    * Get the current status of a given queue ID item.
    *
    * @param {integer} id
    *   Index number of the queue item you wish to check on.
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    getQueueItem: function(id, callback){
      _get('print/' + id, {
        success: function(d){
          if (callback) callback(d);
        },
        error: function(e) {
          if (callback) callback(false, e);
        }
      });
    },

   /**
    * Delete a queue item indentified by index, if printing, will be cancelled.
    *
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    deleteQueueItem: function(id, callback){
      _delete('print/' + id, {
        success: function(d){
          if (callback) callback(d);
        },
        error: function(e) {
          if (callback) callback(false, e);
        }
      });
    },
  };

  function _get(path, options) {
    _request('GET', path, options);
  }
  function _post(path, options) {
    _request('POST', path, options);
  }
  function _put(path, options) {
    _request('PUT', path, options);
  }
  function _delete(path, options) {
    _request('DELETE', path, options);
  }

  function _request(method, path, options) {
    var srv = robopaint.api.server;
    if (!srv) {
      console.error('RoboPaint API client domain configuration not ready. Set robopaint.api.server correctly!');
      return;
    }

    var srvPath = "";

    // If given an absolute server path, use it directly
    if (path[0] === '/') {
      srvPath = path;
    } else { // Otherwise, construct an absolute path from versioned API path
      srvPath = '/robopaint/v' + srv.version + '/' + path;
    }

    var uri = srv.protocol + '://' + srv.domain + ':' + srv.port + srvPath;
    $.ajax({
      url: uri,
      type: method,
      data: options.data,
      success: options.success,
      error: options.error,
      timeout: options.error
    });
  }
})();
