# parse-cache #

#### Parse SDK caching for cloud code or browser that actually works. ####

[![Build Status](https://travis-ci.org/back4app/parse-cache.svg)](https://travis-ci.org/back4app/parse-cache)

## About ##

A Parse caching module that works exactly how you would expect it to, with the latest version of Parse SDK. It can be used on cloud code or on client Browser code.

```
Important:

If you are using Mongoose 4.x or below, you need to use version 4.1 of this library.
```

## Usage ##

```javascript
var Parse = require('parse/node'); // or require('parse') if you are on a Browser
var parseCache = require('parse-cache');

parseCache(Parse, 'MyUniqueAppNameOrKey', {
  engine: 'redis',    /* If you don't specify the redis engine,      */
  port: 6379,         /* the query results will be cached in memory (on browser use memory storage). */
  host: 'localhost'
});

Record
  .cache(30) // The number of seconds to cache the query.  Defaults to 60 seconds.
  .equalTo('someField', 'someValue')
  .find(); // you can use find, first, count, countDocuments, estimatedDocumentCount, aggregate, each, get or distinct
  
```

You can also pass a custom key into the `.cache()` method, which you can then use later to clear the cached content.

```javascript
Record
  .cache(30, 'some_custom_cache_key') // The number of seconds to cache the query.  Defaults to 60 seconds.
  .equalTo('someField', 'someValue')
  .find();

```

Insert `.cache()` into the queries before `find, first, count, countDocuments, estimatedDocumentCount, aggregate, each, get or distinct` if you want to cache, and they will be cached.  Works with `select`, `ascending`, `descending`, and anything else that will modify the results of a query.

## Clearing the cache ##

If you want to clear the cache for a specific query, you must specify the cache key yourself:

```js
function getChildrenByParentId(parentId, cb) {
  Children
    .cache(0, `${parentId}_children`)
    .find({ parentId });
}

function clearChildrenByParentIdCache(parentId, cb) {
  parseCache.clearCache(`${parentId}_children`, cb);
}

// or using async
async function clearChildrenByParentIdCache(parentId) {
  await parseCache.clearCache(`${parentId}_children`);
}
```

If you call `parseCache.clearCache(null, cb) or await parseCache.clearCache()` without passing a cache key as the first parameter, the entire cache will be cleared for all queries.

## Test ##
npm test
