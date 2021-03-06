/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Base store
 * @module store
 */

'use strict';

/**
 * Base store
 * @memberOf module:store
 * @constructor
 */
function Store() {
	this._list = [];
	this._items = {};
}

/**
 * Store length
 * @property {Number}
 * @name module:store.Store.length
 */
Object.defineProperty( Store.prototype, 'length', {
	get: function() {
		return this._list.length;
	}
} );

/**
 * Add an item to the store
 * @param {String} id            ID for the item
 * @param {*}      item          Item to add
 * @param {Number} [priority=10] Priority of the item, a lower number means a higher priority
 */
Store.prototype.add = function( id, item, priority ) {
	if ( typeof priority != 'number' ) {
		priority = 10;
	}

	item = [ id, item, priority ];

	// an item with the same ID exists so we have to remove it first
	if ( this._items[ id ] ) {
		this.remove( id );
	}

	// add to the hashmap
	this._items[ id ] = item;

	for ( var i = this.length - 1; i >= 0; i-- ) {
		// current item has a lower or equal priority so add the item after it
		if ( this._list[ i ][ 2 ] <= priority ) {
			this._list.splice( i + 1, 0, item );

			return;
		}
	}

	// new item has the lowest priority so add it at the beginning
	this._list.unshift( item );
};

/**
 * Get an item with the given ID
 * @param  {String} id ID of an item
 * @return {*|Null}
 */
Store.prototype.get = function( id ) {
	return this._items[ id ] ? this._items[ id ][ 1 ] : null;
};

/**
 * Get the highest item priority
 * @return {Number|Null}
 */
Store.prototype.getHighestPriority = function() {
	return this._list[ 0 ] ? this._list[ 0 ][ 2 ] : null;
};

/**
 * Get the lowest item priority
 * @return {Number|Null}
 */
Store.prototype.getLowestPriority = function() {
	var len = this.length;

	return len > 0 ? this._list[ len - 1 ][ 2 ] : null;
};

/**
 * Get the priority of an item with th given ID
 * @return {Number|Null}
 */
Store.prototype.getPriority = function( id ) {
	return this._items[ id ] ? this._items[ id ][ 2 ] : null;
};

/**
 * List all the items in the store in an array. The items will be ordered using their priorities
 * @return {Array}
 */
Store.prototype.list = function() {
	return this._list.map( function( item ) {
		return item[ 1 ];
	}, this );
};

/**
 * Remove an item with the given ID from the store
 * @param {String} id ID of an item
 */
Store.prototype.remove = function( id ) {
	delete this._items[ id ];

	for ( var i = this.length - 1; i >= 0; i-- ) {
		if ( this._list[ i ][ 0 ] === id ) {
			this._list.splice( i, 1 );

			return;
		}
	}
};

module.exports = Store;
