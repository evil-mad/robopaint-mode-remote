/**
 * @file Holds all Remote Print API wrappers
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

// Initialize wrapper object is this library is being used elsewhere
if (typeof robopaint === 'undefined') var robopaint = {};
if (typeof robopaint.api === 'undefined') var robopaint.api = {};

/**
 * Restful API wrappers
 */
robopaint.api.print = {
/**
  * Get print status without doing anything else.
  * @param {function} callback
  *   Function to callback when done, including data from response body
  */
  status: function(callback){
    _get('print', {
      success: callback,
      error: function(e) {
        if (callback) callback(false, d);
      }
    });
  },

  item: {
   /**
    * Check status of a given print item.
    * @param {integer} itemID
    *   The ID from main print API status queue listing.
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    status: function(itemID, callback){
      _get('print/' + itemID, {
        success: callback,
        error: function(e) {
          callback(false);
        }
      });
    },

   /**
    * Remove/Cancel a given print item
    * @param {integer} itemID
    *   The ID from main print API status queue listing.
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    cancel: function(itemID, callback){
      _delete('print/' + itemID, {
        success: callback,
        error: function(e) {
          callback(false);
        }
      });
    },

   /**
    * Add a new print item
    * @param {string} svgData
    *   The full data of the SVG file to be printed.
    * @param {object} options
    *   The options for the new print item. Options:
    *     .name {string}: The human readable name of the print, for reference.
    *     .settingsOverrides {object}: The print settings to be modified.
    * @param {function} callback
    *   Function to callback when done, including data from response body
    */
    add: function(svgData, options, callback){
      _post('print', {
        data: {svg: svgData, options: options},
        success: callback,
        error: function(e) {
          callback(false);
        }
      });
    },
  }
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
    srvPath = '/robopaint/v' + srv.version + '/' + path
  }

  $.ajax({
    url: srv.protocol + '://' + srv.domain + ':' + srv.port + srvPath,
    type: method,
    data: options.data,
    success: options.success,
    error: options.error,
    timeout: options.error
  });
}
