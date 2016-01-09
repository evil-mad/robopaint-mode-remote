/**
 * @file Holds all RoboPaint Remote automatic painting mode code.
 */
"use strict";

var actualPen = {}; // Hold onto the latest actualPen object from updates.
var buffer = {};
var t = i18n.t; // The mother of all shortcuts
var canvas = rpRequire('canvas');
var originalSettings = {}; // Store the settings we came in with to revert to.

// Our own version of the print queue object. We can't access it as it's outside
// the mode, so this is updated via IPC message.
var queue = [];
var currentQueueID = 0;

// This var mimics the api.ready var. As soon as the user says we're ready,
// we'll enable the API and items can processed.
var readyToPrint = false;

// If True (set by checkbox), the readiness above will not be reset when a
// drawing is complete and the next item in the queue will be processed
// immediately after the last.
var noResetReady = false;

// Our own smack in the face obvious placeholder booblean for being busy.
var busyPrinting = false;

mode.pageInitReady = function () {
  originalSettings = _.extend({}, robopaint.settings);

  // Initialize the paper.js canvas with wrapper margin and other settings.
  canvas.domInit({
    replace: '#paper-placeholder', // jQuery selecter of element to replace
    paperScriptFile: 'remote.ps.js', // The main PaperScript file to load
    wrapperMargin: {
      top: 30,
      left: 30,
      right: 500,
      bottom: 40
    },

    // Called when PaperScript init is complete, requires
    // canvas.paperInit(paper) to be called in this modes paperscript file.
    // Don't forget that!
    loadedCallback: paperLoadedInit
  });

  // Bug the API to give us the full queue whenever it gets around to it.
  sendToAPI('fullQueue');
}


// Trigger load init resize only after paper has called this function.
function paperLoadedInit() {
  // With Paper ready, send a single up to fill values for buffer & pen.
  mode.run('up');

  // Use mode settings management on all "managed" class items. This
  // saves/loads settings from/into the elements on change/init.
  mode.settings.$manage('.managed');
}


// Catch CNCServer buffered callbacks
mode.onCallbackEvent = function(name) {
  switch (name) {
    case 'autoPaintBegin': // Should happen when we've just started
      $('#pause').prop('disabled', false); // Enable pause button
      sendToAPI('checkPercentageStart', currentQueueID);
      break;
    case 'autoPaintComplete': // Should happen when we're completely done
      $('#pause').attr('class', 'ready')
        .attr('title', t('modes.print.status.ready'))
        .text(robopaint.t('common.action.pause'))
        .prop('disabled', true);
      $('#ready').prop('disabled', false); // Enable "ready" checkbox
      $('#buttons button.normal').prop('disabled', false); // Enable options
      $('#cancel').prop('disabled', true); // Disable the cancel print button

      // Queue Item complete!
      busyPrinting = false;
      queue[currentQueueID].updateStatus("complete");
      sendToAPI('finishedItem', currentQueueID);

      // If we're not reset ready status after print, move on to the next item.
      if (noResetReady) {
        checkStartQueue();
      } else {
         // Reset ready status to false
        if (readyToPrint) { $('#ready').click(); }
      }
      break;
  }
};


// Run at either ready trigger or new item (with ready), checks the queue and
// starts running it if applicable.
function checkStartQueue() {
  // If we're not marked as ready to print, OR we're printing... bye bye!
  if (!readyToPrint || busyPrinting) return;

  var qid = nextWaitingQueueID();

  if (qid !== false) {
    processQueueItem(qid);
  }
}

// Find the next waiting queue item, skipping cancelled or complete items.
// Return === false if none.
function nextWaitingQueueID() {
  var findID = _.find(queue, function(item){ return item.status === 'waiting'; });
  return _.isUndefined(findID) ? false : findID.qid;
}

// Process a queue item to be printed
function processQueueItem(qid) {
  currentQueueID = qid;
  queue[qid].updateStatus("printing");
  sendToAPI('printingItem', qid);
  busyPrinting = true; // Turned off at Cancel/autoPaintComplete

  // Setup buttons
  $('#pause')
    .removeClass('ready')
    .text(t('common.action.pause'))
    .prop('disabled', true);
  $('#ready').prop('disabled', true); // Disable "ready" checkbox
  $('#buttons button.normal').prop('disabled', true); // Disable options
  $('#cancel').prop('disabled', false); // Enable the cancel print button

  // Fold the custom settings (if any) into RP current settings
  if (queue[qid].options.settingsOverrides) {
    robopaint.settings = _.extend({}, originalSettings, queue[qid].options.settingsOverrides);
  } else {
    // Ensure settings are default to how they were originally if none passed.
    robopaint.settings = _.extend({}, originalSettings);
  }

  paper.resetAll();
  paper.canvas.loadSVG(queue[qid].svg, true);

  // SVG is imported as a single group, and as the layer is clear, it should be
  // the only thing there. Resize it to fit.
  if (!queue[qid].options.noresize) {
    paper.canvas.mainLayer.children[0].fitBounds(paper.view.bounds);
  }

  paper.renderMotionPaths(function(){
    paper.utils.autoPaint(paper.canvas.actionLayer);
    // Callback for when this completes is handled via cncserver autoPaintComplete
  });
}

// Build out the HTML table body data from the queue
function rebuildQueue() {
  var $q = $('#queue tbody');

  // Remove all previous elements
  $q.empty();

  // Move through each queue item and build the rows
  var q = _.extend([], queue).reverse();
  _.each(q, function(item){
    // Only field referenced as a var, as we'll need to update it directly.
    var $status = $('<td>')
      .addClass('status')
      .text(mode.t('queue.itemStatus.' + item.status));

    $('<tr>').append(
      $('<td>').addClass('id').text(item.qid+1),

      $('<td>').addClass('name').append(
        $('<img>').attr('src', 'data:image/svg+xml;utf8,' + item.svg),
        $('<span>').attr('title', item.options.name).text(item.options.name)
      ),

      $status,

      $('<td>').addClass('time').text(new Date(item.startTime).toTimeString()),

      $('<td>').addClass('settings').html((function(){
        var l = '';
        _.each(_.pairs(item.options.settingsOverrides), function(set){
          l+='<span>' + set.join(": ") + '</span>';
        });

        if (l==='') l = '<span>[' + mode.t('queue.na') + ']</span>';
        return l;
      })())
    ).appendTo($q);

    // Handy item function for updating its visible status after the fact.
    // only takes valid queue item states, handles translation and item setting
    // automatically.
    item.updateStatus = function(status) {
      item.status = status;
      $status.text(mode.t('queue.itemStatus.' + status));
    }
  });
}


// Communication IPC wrapper to flip switches on the API side in RP land.
function sendToAPI(type, data) {
  ipc.sendToHost('remoteprint', type, data);
}

// IPC events from the API on the RoboPaint side.
ipc.on('remoteprint', function(args) {
  switch (args[0]) {
    case 'itemAdded': // Just the queue item that was added.
      queue.push(args[1]);
      rebuildQueue();
      checkStartQueue(); // Check if we should start the queue.
      break;
    case 'itemCancelled': // Just the queue item ID that was cancelled.
      queue[args[1]].updateStatus('cancelled');
      checkStartQueue(); // Check if we should start the queue.
      break;
    case 'fullQueue': // A full queue object
      queue = args[1];
      rebuildQueue();
      // We don't check if we should start the queue here as this only happens
      // at the start, and we always default to NOT ready at the start.
      break;
    case 'forceReady': // The new ready state (if not printing)
      if (readyToPrint != args[1] && !busyPrinting) {
        $('#ready').click();
      }
      break;
  };
});

// Catch the settings update so we're using the most up to date original Settings
ipc.on('settingsUpdate', function(){
  originalSettings = robopaint.utils.getSettings();
});

// Mode API called callback for binding the controls
mode.bindControls = function(){
  // Cancel Print
  $('#cancel').click(function(){
    var cancelPrint = confirm(t("modes.print.status.confirm"));
    if (cancelPrint) {
      paper.resetAll(); // Cleanup paper portions

       // On GP, reset ready status on cancel
      if (readyToPrint) { $('#ready').click(); }

      mode.onCallbackEvent('autoPaintComplete');
      mode.fullCancel(mode.t('status.cancelled'));
    }
  });

  // Enable fancy IOS style checkboxes
  $('input[type="checkbox"].fancy').each(function(){
    var $item = $(this);
    // Extra div and click handler for "fancy" IOS checkbox style
    $item.after($('<div>').click(function(){ $item.click(); }));
  });

  // Bind click for ready checkbox
  $('#ready').change(function(){
    // Tell the API if we're ready (or not)
    readyToPrint = $(this).is(':checked');
    sendToAPI(readyToPrint ? 'ready' : 'notReady');

    checkStartQueue(); // Check if we should start the queue.
  })

  // Bind change/var management for noreset
  $('#noreset').change(function(){
    noResetReady = $(this).is(':checked');
  })

  // Bind pause click and functionality
  $('#pause').click(function() {

    if (buffer.length !== 0) {
      // With something in the queue... we're either pausing, or resuming
      if (!buffer.paused) {
        // Starting Pause =========
        $('#pause').prop('disabled', true).attr('title', t("status.wait"));
        mode.run([
          ['status', t("status.pausing")],
          ['pause']
        ], true); // Insert at the start of the buffer so it happens immediately

        mode.onFullyPaused = function(){
          mode.run('status', t("status.paused"));
          $('#buttons button.normal').prop('disabled', false); // Enable options
          $('#pause')
            .addClass('active')
            .attr('title', t("status.resume"))
            .prop('disabled', false)
            .text(t("common.action.resume"));
        };
      } else {
        // Resuming ===============
        $('#buttons button.normal').prop('disabled', true); // Disable options
        mode.run([
          ['status', t("status.resuming")],
          ['resume']
        ], true); // Insert at the start of the buffer so it happens immediately

        mode.onFullyResumed = function(){
          $('#pause')
            .removeClass('active')
            .attr('title', t("mode.print.status.pause"))
            .text(t('common.action.pause'));
          mode.run('status', t("status.resumed"));
        };
      }
    }
  });

  // Bind to control buttons
  $('#park').click(function(){
    // If we're paused, skip the buffer
    mode.run([
      ['status', t("status.parking"), buffer.paused],
      ['park', buffer.paused], // TODO: If paused, only one message will show :/
      ['status', t("status.parked"), buffer.paused]
    ]);
  });


  $('#pen').click(function(){
    // Run height pos into the buffer, or skip buffer if paused
    var newState = 'up';
    if (actualPen.state === "up" || actualPen.state === 0) {
      newState = 'down';
    }

    mode.run(newState, buffer.paused);
  });

  // Motor unlock: Also lifts pen and zeros out.
  $('#disable').click(function(){
    mode.run([
      ['status', t("status.unlocking")],
      ['up'],
      ['zero'],
      ['unlock'],
      ['status', t("status.unlocked")]
    ]);
  });
}

// Warn the user on close about cancelling jobs.
mode.onClose = function(callback) {
  if (buffer.length) {
    // TODO: Does exiting count as a cancel? or a reset status?
    var r = confirm(i18n.t('common.dialog.confirmexit'));
    if (r == true) {
      // As this is a forceful cancel, shove to the front of the queue
      mode.run(['clear', 'park', 'clearlocal'], true);
      callback(); // The user chose to close.
    }
  } else {
    callback(); // Close, as we have nothing the user is waiting on.
  }
}

// Actual pen update event
mode.onPenUpdate = function(botPen){
  paper.canvas.drawPoint.move(botPen.absCoord, botPen.lastDuration);
  actualPen = $.extend({}, botPen);

  // Update button text/state
  // TODO: change implement type <brush> based on actual implement selected!
  var key = 'common.action.brush.raise';
  if (actualPen.state === "up" || actualPen.state === 0){
    key = 'common.action.brush.lower';
  }
  $('#pen').text(t(key));
}

// An abbreviated buffer update event, contains paused/not paused & length.
mode.onBufferUpdate = function(b) {
  buffer = b;
}
