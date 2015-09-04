const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/*
 * Function to pick up Zotero and tinker with it.
 */
var Zotero;
function ifZotero(succeed, fail) {
    var ZoteroClass = Cc["@zotero.org/Zotero;1"];
    if (ZoteroClass) {
        Zotero = ZoteroClass
	        .getService(Ci.nsISupports)
	        .wrappedJSObject;
        succeed ? succeed(Zotero) : null;
    } else {
        fail ? fail() : null;
    }
}

var ObserveStartup = function () {};

ObserveStartup.prototype = {
    observe: function(subject, topic, data) {
        var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
	    var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Ci.nsISupports).wrappedJSObject;
        AbbrevsFilter.initComponent(Zotero);
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.removeObserver(this, "content-document-global-created");
    },
    register: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(this, "content-document-global-created", false);
    },
    unregister: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.removeObserver(this, "content-document-global-created");
    }
}

var observeStartup = new ObserveStartup();

var ObservePopups = function () {};

ObservePopups.prototype = {
    observe: function(subject, topic, data) {
        var wnd = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        wnd.addEventListener("DOMContentLoaded", function (event) {
            var doc = event.target;
            if (doc.documentElement.getAttribute('id') !== 'csl-edit') return;
            var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;

	        var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
	        AbbrevsFilter.initWindow(doc.defaultView, doc);

            var hasEngine = false;

	        var refresh = doc.getElementById("preview-refresh-button");
	        var cslmenu = doc.getElementById("zotero-csl-list");
	        var csleditor = doc.getElementById("zotero-csl-editor");

	        var button = doc.createElement("button");
	        button.setAttribute("label", "Abbrevs.");
	        button.setAttribute("id","abbrevs-button");
            button.setAttribute('disabled','true');
	        cslmenu.parentNode.insertBefore(button, null);

	        function attachStyleEngine () {
                if (hasEngine) return;
                var button = doc.getElementById('abbrevs-button');
                var items = Zotero.getActiveZoteroPane().getSelectedItems();
                if (items.length > 0) {
                    button.removeAttribute('disabled');
	                button.addEventListener("command", function() {
		                var io = {
                            style:csleditor.styleEngine,
                            AFZ: AbbrevsFilter
                        };
                        io.wrappedJSObject = io;
                        wnd.openDialog('chrome://abbrevs-filter/content/dialog.xul', 'AbbrevsFilterDialog', 'chrome,centerscreen,alwaysRaised,modal',io);
                    }, false);
                    hasEngine = true;
                }
	        }
            attachStyleEngine();

	        cslmenu.addEventListener("command", attachStyleEngine, false);
	        refresh.addEventListener("command", attachStyleEngine, false);
            button.addEventListener("command", attachStyleEngine, false);

        }, false);
    },
    register: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(this, "chrome-document-global-created", false);
    },
    unregister: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.removeObserver(this, "chrome-document-global-created");
    }
}
var observePopups = new ObservePopups();


/*
 * Bootstrap functions
 */

var AbbrevsFilterFactory;
var AbbrevsService;

function startup (data, reason) {
    // Empty context for build
    var buildContext = {};

    // Build and instantiate the component
    var xpcomFiles = [
	    "load",
        "update",
	    "window",
        "style",
        "adddel",
        "csl-get-abbreviation",
        "csl-suppress-jurisdictions",
	    "import",
	    "export"
    ];
    for (var i=0, ilen=xpcomFiles.length; i < ilen; i += 1) {
	    Cc["@mozilla.org/moz/jssubscript-loader;1"]
		    .getService(Ci.mozIJSSubScriptLoader)
		    .loadSubScript("chrome://abbrevs-filter/content/xpcom/" + xpcomFiles[i] + ".js", buildContext);
    }

    var AbbrevsService = function () {
	    this.wrappedJSObject = new buildContext.AbbrevsFilter();
    };

    // Define the service
    AbbrevsService.prototype = {
        classDescription: 'Juris-M Abbreviation Filter',
        contractID: '@juris-m.github.io/abbrevs-filter;1',
        classID: Components.ID("{e2731ad0-8426-11e0-9d78-0800200c5798}"),
        service: true,
        QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports])
    }

    // Plugin factory
    AbbrevsFilterFactory = Object.freeze({
        createInstance: function(aOuter, aIID) {
            if (aOuter) { throw Cr.NS_ERROR_NO_AGGREGATION; }
            return new AbbrevsService();
        },
        loadFactory: function (aLock) { /* unused */ },
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory])
    });

    const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(AbbrevsService.prototype.classID,
                              AbbrevsService.prototype.classDescription,
                              AbbrevsService.prototype.contractID,
                              AbbrevsFilterFactory);
    observeStartup.register();
    observePopups.register();
}

function shutdown (data, reason) {
    observePopups.unregister();
    const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.unregisterFactory(AbbrevsService.prototype.classID,
                                AbbrevsFilterFactory);
}

function install (data, reason) {}
function uninstall (data, reason) {}
