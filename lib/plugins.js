/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Manages plugins
 */

'use strict';

var path = require( 'path' ),
	fs = require( 'graceful-fs' ),
	_ = require( 'lodash' ),
	Store = require( './store' ),
	logger = require( './logger' ).create( 'plugins', true );

/**
 * @module plugin-manager
 */
module.exports = {

	name: 'plugin-manager',

	attach: function() {
		logger.debug( 'attach' );

		var bender = this,
			plugins;

		/**
		 * Framework plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name frameworks
		 */
		bender.frameworks = new Store();

		/**
		 * Middleware plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name middlewares
		 */
		bender.middlewares = new Store();

		/**
		 * Page builder plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name pagebuilders
		 */
		bender.pagebuilders = new Store();

		/**
		 * Pre-processor plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name preprocessors
		 */
		bender.preprocessors = new Store();

		/**
		 * Reporter plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name reporters
		 */
		bender.reporters = new Store();

		/**
		 * Test builder plugins store
		 * @type {module:store.Store}
		 * @memberOf module:bender
		 * @name testbuilders
		 */
		bender.testbuilders = new Store();

		/**
		 * Plugins manager
		 * @type {module:plugin-manager}
		 * @memberOf module:bender
		 */
		plugins = {
			/**
			 * List of files used by plugins
			 * @priate
			 * @type {Array}
			 */
			_fileList: [],

			/**
			 * Lists of files to be included in the test context, used internally
			 * @private
			 * @type {Object}
			 */
			_include: {
				js: [],
				css: []
			},

			/**
			 * Add a plugin
			 * @param {Object}         options       Plugin configuration
			 * @param {String}         options.name  Plugin's name
			 * @param {Array.<String>} options.files Plugin's files
			 * @memberOf module:plugin-manager
			 */
			add: function( options ) {
				logger.debug( 'add', options.name );

				var match,
					plugin,
					group,
					name,
					type;

				if ( !options.name ) {
					logger.error( 'Missing name of a plugin:', options );
					process.exit( 1 );
				}

				if ( typeof options.name != 'string' ||
					( ( match = options.name.split( '-' ) ) &&
						match[ 0 ] !== 'bender' || !match[ 1 ] ) ) {
					logger.error( 'Invalid plugin name:', options.name );
					process.exit( 1 );
				}

				if ( match.length == 2 ) {
					name = match[ 1 ];
				} else {
					type = match[ 1 ];
					name = match[ 2 ];

					if ( !( group = bender[ type + 's' ] ) ) {
						logger.error( 'Invalid plugin type "%s" of a plugin "%s"', type, options.name );
						process.exit( 1 );
					}
				}

				if ( type === 'reporter' ) {
					plugin = new Reporter( name, options );
				} else if ( type === 'pagebuilder' ) {
					plugin = new PageBuilder( name, options );
				} else if ( type === 'testbuilder' ) {
					plugin = new TestBuilder( name, options );
				} else {
					plugin = new Plugin( name, options );

					// add a plugin to its group
					if ( group ) {
						group.add( name, plugin.build || plugin.process || plugin );
					}
				}

				// attach a plugin to a proper plugin group if needed
				if ( plugin.attach && plugin.attach !== options.attach ) {
					bender.use( plugin );
				}

				// mark plugin's files as valid, shared files
				if ( plugin.files ) {
					this.addFiles( plugin.files );
				}

				// add files to include in the test context
				if ( plugin.include ) {
					this.addInclude( plugin.include );
				}
			},

			/**
			 * Add files to the list of valid, shared files
			 * @param {Array.<String>} files File paths
			 * @memberOf module:plugin-manager
			 */
			addFiles: function( files ) {
				logger.debug( 'add files', files );

				plugins._fileList = plugins._fileList.concat( files );
			},

			/**
			 * Add files to be included in the test context
			 * @param {Array.<String>} files Array of file paths
			 * @memberOf module:plugin-manager
			 */
			addInclude: function( files ) {
				logger.debug( 'add include', files );

				parseFiles( files, plugins._include );
			},

			/**
			 * Get lists of scripts and stylesheets to include
			 * @return {Object}
			 * @memberOf module:plugin-manager
			 */
			getIncludes: function() {
				return plugins._include;
			},

			/**
			 * Check if given path is defined in plugins.
			 * This function is used to validate whether a file should be served or not
			 * because plugins' files have absolute paths and we don't want to give the
			 * access to the file system that way...
			 * @param  {String} file File path
			 * @return {Boolean}
			 * @memberOf module:plugin-manager
			 */
			checkFile: function( file ) {
				logger.debug( 'check file', file );

				return plugins._fileList.indexOf( path.normalize( file ) ) > -1;
			},

			/**
			 * Load plugins defined in Bender configuration
			 * @memberOf module:plugin-manager
			 */
			load: function() {
				if ( !Array.isArray( bender.conf.plugins ) ) {
					return;
				}

				logger.debug( 'load plugins: ', bender.conf.plugins );

				bender.conf.plugins = parseWildCards( bender.conf.plugins );

				bender.conf.plugins.forEach( function( name ) {
					var plugin,
						pluginPath;

					logger.debug( 'load plugin:', name );

					try {
						if ( fs.existsSync( ( pluginPath = path.resolve( name ) ) ) ) {
							plugin = require( pluginPath );
						} else {
							plugin = require( path.join( process.cwd(), '/node_modules/', name ) );
						}
					} catch ( err ) {
						logger.error( 'Couldn\'t include plugin: ' + name );
						logger.error( 'Reason:', err.message );
						logger.error( 'Please check if the plugin was properly installed via NPM ' +
							' or the path to the plugin is valid.' );

						process.exit( 1 );
					}

					// attach server side plugins
					if ( plugin.attach ) {
						bender.use( plugin );
					} else {
						this.add( plugin );
					}

					logger.info( 'Loaded plugin: %s', name );
				}, this );
			}
		};

		// used to fix conflicts with internal application's property called 'plugins'
		bender.plugins = _.merge( plugins, bender.plugins );

		/**
		 * Bender base plugin constructor
		 * @param {String} name    Plugin name
		 * @param {Object} options Configuration options
		 * @memberOf module:plugin-manager
		 * @constructor
		 */
		function Plugin( name, options ) {
			_.merge( this, options, {
				name: name
			} );

			if ( options.files ) {
				parseFiles( options.files, this );
			}

			if ( options.include ) {
				this.include = options.include;
			}
		}

		/**
		 * Bender reporter plugin constructor
		 * @param {String} name    Reporter name
		 * @param {Object} options Configuration options
		 * @memberOf module:plugin-manager
		 * @extends {module:plugin-manager.Plugin}
		 * @constructor
		 */
		function Reporter( name, options ) {
			var that = this;

			Plugin.call( this, name, options );

			bender.onAny( function() {
				if ( typeof that[ this.event ] == 'function' ) {
					that[ this.event ].apply( bender, arguments );
				}
			} );

			/**
			 * Attach a reporter to Bender reporters
			 */
			this.attach = function() {
				bender.reporters.add( name, that );
			};
		}

		Reporter.prototype = Object.create( Plugin.prototype );
		Reporter.constructor = Plugin;

		/**
		 * Page builder plugin constructor
		 * @param {String} name    Page builder name
		 * @param {Object} options Configuration options
		 * @memberOf module:plugin-manager
		 * @extends {module:plugin-manager.Plugin}
		 * @constructor
		 */
		function PageBuilder( name, options ) {
			var that = this;

			Plugin.call( this, name, options );

			this.name = options.name;

			/**
			 * Attach a page builder to Bender page builders.
			 * If the HTML page builder is present, add this one before it
			 */
			this.attach = function() {
				var priority = bender.pagebuilders.getPriority( 'html' );

				// change the priority to add this one before the HTML builder
				if ( typeof priority == 'number' ) {
					priority--;
				}

				bender.pagebuilders.add( name, that.build, priority );
			};
		}

		PageBuilder.prototype = Object.create( Plugin.prototype );
		PageBuilder.constructor = Plugin;

		/**
		 * Test builder constructor
		 * @param {String} name    Test builder name
		 * @param {Object} options Configuration options
		 * @memberOf module:plugin-manager
		 * @extends {module:plugin-manager.Plugin}
		 * @constructor
		 */
		function TestBuilder( name, options ) {
			var that = this;

			Plugin.call( this, name, options );

			/**
			 * Attach a test builder to Bender test builders
			 */
			this.attach = function() {
				bender.testbuilders.add( name, that.build );
			};
		}

		TestBuilder.prototype = Object.create( Plugin.prototype );
		TestBuilder.constructor = Plugin;

		/**
		 * Parse file paths and assign them to appropriate arrays in the target object
		 * @param {Array.<String>} files  Array of files
		 * @param {Object}         target Target object
		 * @private
		 */
		function parseFiles( files, target ) {
			var pattern = /\.(css|js)$/;

			target.js = target.js || [];
			target.css = target.css || [];

			files.forEach( function( file ) {
				var ext = pattern.exec( file );

				/* istanbul ignore else */
				if ( ext ) {
					target[ ext[ 1 ] ].push(
						path.join( '/plugins/', file ).split( path.sep ).join( '/' )
					);
				}
			} );
		}

		/**
		 * Parse wildcards found in the given list of plugins and return all the plugins that match
		 * @param  {Array.<String>} plugins List of plugins
		 * @return {Array}
		 * @private
		 */
		function parseWildCards( plugins ) {
			var hasWildCards = plugins.some( function( plugin ) {
					return plugin.indexOf( '*' ) > -1;
				} ),
				availablePlugins,
				toUse = [];

			if ( !hasWildCards ) {
				return plugins;
			}

			availablePlugins = fs.readdirSync( path.resolve( 'node_modules/' ) );

			plugins.forEach( function( plugin ) {
				var pattern;

				if ( plugin.indexOf( '*' ) > -1 ) {
					pattern = new RegExp( plugin.replace( /\*/g, '.*' ), 'i' );
					toUse = toUse.concat( availablePlugins.filter( function( name ) {
						return pattern.test( name );
					} ) );
				} else {
					toUse.push( plugin );
				}
			} );

			return _.uniq( toUse );
		}
	}
};
