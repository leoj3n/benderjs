/**
 * @file Manages clients connected to the server
 */
var util = require('util'),
    ua = require('useragent'),
    log = require('./logger').create('clients', true),
    Collection = require('./collection');

/**
 * Client browser
 * @param {Object} data        Client properties
 * @param {String} data.id     Client's unique ID
 * @param {String} data.ua     Client's User Agent
 * @class
 */
function Client(data) {
    this.ua = data.parsed.toString();
    this.browser = data.parsed.family.toLowerCase();
    this.version = data.parsed.major;
    this.addr = data.addr;
    this.id = data.id;
    this.ready = true;
}

function Browser(data) {
    this.id = data.id;
    this.name = data.name;
    this.version = data.version;
    this.clients = new Collection();
}

Browser.prototype.get = function () {
    return {
        id: this.id,
        name: this.name,
        version: this.version,
        clients: this.clients.get()
    };
};

module.exports = {

    name: 'browsers',

    attach: function () {
        var bender = this;

        bender.checkDeps(module.exports.name, 'conf');
        
        /**
         * Browsers collection
         * @extends {Collection}
         */
        function Browsers () {
            Collection.call(this);

            this.clients = new Collection();
            this.unknown = new Collection();
        }

        util.inherits(Browsers, Collection);

        Browsers.prototype.get = function (id) {
            var result;

            if (typeof id == 'string') return this.items[id];
            
            if (Array.isArray(id)) {
                return id.map(function (name) {
                    return this.items[name];
                }, this).filter(function (item) {
                    return item !== undefined;
                });
            }

            result = this.list().map(function (name) {
                return this.items[name].get();
            }, this);

            // add unknown browsers at the end of the list
            if (this.unknown.list().length) {
                result = result.concat([{
                    id: 'Unknown',
                    name: 'unknown',
                    clients: this.unknown.get()
                }]);
            }

            return result;
        };

        Browsers.prototype.validate = function (config) {
            function isValid(browser) {
                return browser && typeof browser == 'string';
            }

            if (!config.browsers || !config.browsers.length) {
                log.error('No browsers for tests configured');
                process.exit(1);
            }

            if (!config.browsers.every(isValid)) {
                log.error('Invalid browsers specified');
                process.exit(1);
            }
        };

        Browsers.prototype.build = function (config) {
            var pattern = /^([a-z]+)(\d*)/i;

            config.browsers.forEach(function (browser) {
                if ((match = pattern.exec(browser))) {
                    this.add(browser, new Browser({
                        id: browser,
                        name: match[1].toLowerCase(),
                        version: match[2]
                    }));
                }
            }, this);
        };

        Browsers.prototype.addClient = function (data) {
            var browsers,
                client;

            if (!data.ua) return;

            data.parsed = ua.parse(data.ua);
            client = new Client(data);

            function handleBrowser(browser) {
                if (browser.version === data.parsed.major || !browser.version) {
                    browser.clients.add(data.id, client);
                    return true;
                }
            }

            browsers = this.find('name', data.parsed.family.toLowerCase());

            if (!browsers.length || !browsers.some(handleBrowser)) {
                this.unknown.add(data.id, client);
            }

            this.clients.add(data.id, client);

            this.emit('change', this.get());
        };

        Browsers.prototype.removeClient = function (id) {
            this.each(function (browser) {
                browser.clients.remove(id);
            });
            
            this.unknown.remove(id);
            this.clients.remove(id);

            this.emit('change', this.get());
        };

        Browsers.prototype.setClientReady = function (id, state) {
            var client = this.clients.findOne('id', id);

            if (!client) return;

            client.ready = state === undefined ? true : state;
            this.emit('client:change', client);
        };

        bender.browsers = new Browsers();
    },

    init: function (done) {
        var bender = this;

        bender.browsers.validate(bender.conf);
        bender.browsers.build(bender.conf);

        bender.browsers.on('change', function (browsers) {
            bender.emit('browsers:change', browsers);
        });

        bender.browsers.on('client:change', function (client) {
            bender.emit('client:change', client);
        });

        bender.on('client:register', bender.browsers.addClient.bind(bender.browsers));
        bender.on('client:disconnect', bender.browsers.removeClient.bind(bender.browsers));

        done();
    }
};
    
    