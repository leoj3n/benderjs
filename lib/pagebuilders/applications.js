/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Page builder responsible for application resources
 */

'use strict';

/**
 * @module pagebuilders/applications
 */
module.exports = {
	name: 'bender-pagebuilder-applications',
	/**
	 * Include application resources in a test page
	 * @param  {Object} data Test page data
	 * @return {Object}
	 */
	build: function( data ) {
		if ( !Array.isArray( data.applications ) || !data.applications.length ) {
			return data;
		}

		// inject scripts and stylesheets for the applications
		data.applications.forEach( function( app ) {
			app.css.forEach( function( css ) {
				data.addCSS( css );
			} );
			app.js.forEach( function( js ) {
				data.addJS( js );
			} );
		} );

		return data;
	}
};
