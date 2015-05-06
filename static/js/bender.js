/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Runner code for tests launched in dashboard
 */

/* global console */

( function( window ) {
	'use strict';

	function Bender() {
		var contextEl = document.getElementById( 'context' ),
			that = this,
			runs = 0,
			testTimeout,
			testWindow;

		this.handlers = {};
		this.current = null;
		this.suite = null;
		this.runAsChild = true;
		this.config = window.BENDER_CONFIG;

		this.results = null;

		function clearTestTimeout() {
			if ( testTimeout ) {
				clearTimeout( testTimeout );
			}
		}

		function resetTestTimeout() {
			if ( !that.config || !that.config.testTimeout ) {
				return;
			}

			clearTestTimeout();

			testTimeout = setTimeout( function() {
				var result = {
					id: that.current,
					success: false,
					broken: true
				};

				that.next( JSON.stringify( result ) );

			}, that.config.testTimeout );
		}

		function addFrame( id ) {
			var frame = document.createElement( 'iframe' );

			frame.className = 'context-frame';
			frame.src = id;
			contextEl.appendChild( frame );
		}

		function removeFrame() {
			var frame = contextEl.getElementsByTagName( 'iframe' )[ 0 ];

			contextEl.className = '';

			if ( frame ) {
				frame.src = 'about:blank';
				contextEl.removeChild( frame );
			}
		}

		this.emit = function( name ) {
			var handlers = this.handlers[ name ],
				args = Array.prototype.slice.call( arguments, 1 ),
				i;

			if ( !handlers || !handlers.length ) {
				return;
			}

			for ( i = 0; i < handlers.length; i++ ) {
				handlers[ i ].apply( this, args );
			}
		};

		this.on = function( name, callback ) {
			if ( typeof name !== 'string' || typeof callback != 'function' ) {
				throw new Error( 'Invalid arguments specified' );
			}

			if ( !this.handlers[ name ] ) {
				this.handlers[ name ] = [];
			}

			this.handlers[ name ].push( callback );
		};

		this.error = function( error ) {
			this.emit( 'error', error );

			if ( bender.env.supportsConsole ) {
				console.log( JSON.parse( error ) );
			}
		};

		this.log = function( message ) {
			if ( bender.env.supportsConsole ) {
				console.log( message );
			}
		};

		this.result = function( result ) {
			var parsed = JSON.parse( result );

			if ( !parsed.success ) {
				if ( !this.results ) {
					this.results = {};
				}

				this.results[ parsed.name ] = parsed;
			}

			resetTestTimeout();
		};

		this.next = function( summary ) {
			var parsed,
				id;

			if ( summary ) {
				parsed = JSON.parse( summary );
				parsed.id = this.current;
				parsed.success = parsed.success || (
					parsed.failed === 0 &&
					parsed.errors === 0 &&
					( parsed.passed > 0 || parsed.ignored > 0 )
				);
				parsed.results = this.results;
				parsed.state = 'done';
				this.emit( 'update', parsed );
				this.results = null;
			}

			this.current = this.suite.shift();

			if ( this.current ) {
				id = '/' + this.current + '#child';
				runs++;

				this.emit( 'update', {
					id: this.current,
					state: 'started'
				} );

				if ( bender.env.ie ) {
					if ( runs >= 20 && testWindow ) {
						testWindow.close();
						setTimeout( function() {
							runs = 0;
							testWindow = window.open( id, 'bendertest' );
						}, 300 );
					} else {
						if ( !testWindow || testWindow.closed ) {
							testWindow = window.open( id, 'bendertest' );
						} else {
							if ( id === testWindow.location.href.split( testWindow.location.host )[ 1 ] ) {
								testWindow.location.reload();
							} else {
								testWindow.location.href = id;
							}
						}
					}
				} else {
					removeFrame();
					addFrame( id );
				}

				resetTestTimeout();
			} else {
				this.complete();
			}
		};

		this.complete = function() {
			this.emit( 'complete' );

			this.suite = [];
			this.current = null;

			if ( bender.env.ie && testWindow ) {
				testWindow.close();
				testWindow = null;
			} else {
				removeFrame();
			}

			clearTestTimeout();
		};

		this.ignore = function( result ) {
			result = JSON.parse( result );

			result.ignored = true;
			result.success = true;
			result.id = this.current;

			this.next( JSON.stringify( result ) );
		};

		this.run = function( tests ) {
			this.suite = tests;
			this.next();
		};

		this.maximize = function() {
			if ( !bender.env.ie ) {
				contextEl.className = 'maximized';
			}

			// clear timeout for manual tests
			clearTestTimeout();
		};

		this.stop = this.complete;
	}

	var env = window.bender.env;
	window.bender = new Bender();
	window.bender.env = env;
} )( this );
