'use strict';

/* eslint-env node, mocha */
/* global should */

require('should');

// uncomment to emulate browser
// global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
//
// global.localStorage = {
//   setItem: (k, v) => {
//     global.localStorage[k] = v;
//   },
//   getItem: (k) => {
//     return global.localStorage[k];
//   }
// };
// const Parse = require('parse');

const Parse = require('parse/node');
const parseCache = require('../src');

let RecordObject;

describe('parse-cache', function() {
  this.timeout(20000);

  before((done) => {
    // parseCache(Parse, 'MyAppName', { engine: 'redis' });
    parseCache(Parse, 'MyAppName');

    Parse.initialize('appId', 'javascriptKey', 'masterKey');
    Parse.serverURL="http://127.0.0.1:1337"

    RecordObject = Parse.Object.extend('Record');

    done();
  });

  after(parseCache.close);

  beforeEach(() => {
    return generate(10);
  });

  afterEach((done) => {
    const Record = new Parse.Query(RecordObject);
    Record.find().then((records) => {
      return Parse.Object.destroyAll(records).then(() => {
        const promise = Promise.all([parseCache.clearCache(null)]);
        promise.then(() => {
          done();
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it('should have cache method after initialization', () => {
    const Record = new Parse.Query(RecordObject);
    Record.cache.should.be.a.Function;
  });

  it('should cache a simple query that uses promises with then', (done) => {
    getAll(60).then((res) => {
      res.length.should.equal(10);

      generate(10).then(() => {
        getAll(60).then((res) => {
          res.length.should.equal(10);
          res.map(obj => obj.fromCache.should.equal(true));
          done();
        }).catch(done);
      });
    }).catch(done);
  });

  it('should cache a simple query that uses promises', async () => {
    const res = await getAll(60);
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);
    const cachedRes = await getAll(60);
    cachedRes.length.should.equal(10);
  });

  it('should not cache the same query w/out a ttl defined', async () => {
    const res = await getAll(60);
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    const nonCachedResponse = await getAllNoCache();
    nonCachedResponse.map(obj => should.not.exist(obj.fromCache));
    nonCachedResponse.length.should.equal(20);
  });

  it('should return a Parse model from cached and non-cached results', (done) => {
    getAll(60).then((res) => {
      res.map(obj => should.not.exist(obj.fromCache));
      const first = res[0];

      getAll(60).then((res2) => {
        res2.map(obj => obj.fromCache.should.equal(true));
        const cachedFirst = res2[0];
        first.constructor.name.should.equal('ParseObjectSubclass');
        cachedFirst.constructor.name.should.equal('ParseObjectSubclass');

        res[0].isNew.should.be.false;
        res2[0].isNew.should.be.false;

        done();
      }).catch(done);
    }).catch(done);
  });

  it('should cache a query that returns no results', async () => {
    const empty = await getNone(60);
    empty.length.should.equal(0);

    await generate(10);

    const cachedEmpty = await getNone(60);
    cachedEmpty.length.should.equal(0);
  });

  it('should correctly cache queries using select', async () => {
    const res = await getAllSelect(60, 'str');
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    const cachedRes = await getAllSelect(60, 'str');
    cachedRes.map(obj => obj.fromCache.should.equal(true));
    cachedRes.length.should.equal(10);

    const nonCached = await getAllSelect(60, 'num');
    nonCached.map(obj => should.not.exist(obj.fromCache));
    nonCached.length.should.equal(20);

    const nonCached2 = await getAllSelect(60, 'num', 'str');
    nonCached2.map(obj => should.not.exist(obj.fromCache));
    nonCached2.length.should.equal(20);

    const cached2 = await getAllSelect(60, 'num', 'str');
    cached2.map(obj => obj.fromCache.should.equal(true));
    cached2.length.should.equal(20);
  });

  it('should correctly cache queries using distinct', async () => {
    const res = await getAllDistinct(60, 'str');
    res.length.should.equal(10);

    const nonCached = await getAllDistinct(60, 'seqNum');
    nonCached.length.should.equal(10);

    await generate(10);

    const cachedRes = await getAllDistinct(60, 'str');
    cachedRes.length.should.equal(10);

    const cachedRes2 = await getAllDistinct(60, 'seqNum');
    cachedRes2.length.should.equal(10);

    const nonCached2 = await getAllDistinct(60, 'num');
    nonCached2.length.should.equal(10);

    const cachedRes3 = await getAllDistinct(60, 'num');
    cachedRes3.length.should.equal(10);

    const nonCached3 = await getAllDistinctNonCached('seqNum');
    nonCached3.length.should.equal(20);
  });

  it('should correctly cache queries using skip', async () => {
    const res = await getWithSkip(1, 60);
    res.length.should.equal(9);

    await generate(10);

    const cachedRes = await getWithSkip(1, 60);
    cachedRes.map(obj => obj.fromCache.should.equal(true));
    cachedRes.length.should.equal(9);

    const nonCached = await getWithSkip(2, 60);
    nonCached.map(obj => should.not.exist(obj.fromCache));
    nonCached.length.should.equal(18);
  });

  it('should correctly cache queries using limit', async () => {
    const res = await getWithLimit(5, 60);
    res.length.should.equal(5);

    const Record = new Parse.Query(RecordObject);
    await Record.find().then(Parse.Object.destroyAll);

    const cached = await getWithLimit(5, 60);
    cached.map(obj => obj.fromCache.should.equal(true));
    cached.length.should.equal(5);

    await generate(10);

    const nonCached = await getWithLimit(4, 60);
    nonCached.map(obj => should.not.exist(obj.fromCache));
    nonCached.length.should.equal(4);
  });

  it('should correctly cache the same query with different condition orders', async () => {
    const res = await getWithUnorderedQuery(60);
    res.length.should.equal(10);

    await generate(10);

    const cached = await getWithUnorderedQuery(60);
    cached.length.should.equal(10);
  });

  it('should cache a findOne query', async () => {
    const one = await getOne(60);
    Boolean(one).should.be.true;

    const Record = new Parse.Query(RecordObject);
    await Record.find().then(Parse.Object.destroyAll);

    const cachedOne = await getOne(60);
    Boolean(cachedOne).should.be.true;
  });

  it('should cache a regex condition properly', async () => {
    const res = await getAllWithRegex(60);
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    const cached = await getAllWithRegex(60);
    cached.length.should.equal(10);
    cached.map(obj => obj.fromCache.should.equal(true));

    const nonCached = await getNoneWithRegex(60);
    nonCached.map(obj => should.not.exist(obj.fromCache));
    nonCached.length.should.equal(0);
  });

  it('should cache a query rerun many times', async () => {
    const res = await getAll(60);
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    await Promise.all(new Array(20).join('.').split('').map(() => getAll(60).then((cached) => {
      cached.length.should.equal(10);
      cached.map(obj => obj.fromCache.should.equal(true));
    })));

    const cached = await getAll(60);
    cached.map(obj => obj.fromCache.should.equal(true));
    cached.length.should.equal(10);
  });

  it('should expire the cache', (done) => {
    getAll(1).then(() => {
      setTimeout(() => {
        getAll(1).then((res) => {
          Boolean(res[0].fromCache).should.be.false;
          done();
        }).catch(done);
      }, 1200);
    }).catch(done);
  });

  // it('should cache aggregate queries that use callbacks', (done) => {
  //   aggregate(60).then((res) => {
  //
  //     res[0].total.should.equal(45);
  //
  //     generate(10).then(() => {
  //       aggregate(60).then((cached) => {
  //         cached[0].total.should.equal(45);
  //         done();
  //       }).catch(done);
  //     }).catch(done);
  //   }).catch(done);
  // });
  //
  // it('should cache aggregate queries that use Promises', async () => {
  //   const [res] = await aggregate(60);
  //   res.total.should.equal(45);
  //
  //   await generate(10);
  //
  //   const [cached] = await aggregate(60);
  //   cached.total.should.equal(45);
  // });

  it('should clear a custom cache key', async () => {
    const res = await getAllCustomKey(60, 'custom-key');
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    const cached = await getAllCustomKey(60, 'custom-key');
    cached.map(obj => obj.fromCache.should.equal(true));
    cached.length.should.equal(10);

    await parseCache.clearCache('custom-key');

    const notCached = await getAllCustomKey(60, 'custom-key');
    notCached.map(obj => should.not.exist(obj.fromCache));
    notCached.length.should.equal(20);
  });

  it('should cache a count query', async () => {
    const res = await count(60);
    res.should.equal(10);

    await generate(10);

    const cached = await count(60);
    cached.should.equal(10);
  });

  it('should cache a count query with zero results', async () => {
    const Record = new Parse.Query(RecordObject);
    await Record.find().then(Parse.Object.destroyAll);

    const res = await count(60);
    res.should.equal(0);

    await generate(2);
    const cached = await count(60);

    cached.should.equal(0);
  });

  it('should correctly cache a query with a sort order', async () => {
    const res = await getAllSorted('num');
    res.map(obj => should.not.exist(obj.fromCache));
    res.length.should.equal(10);

    await generate(10);

    const cached = await getAllSorted('num');
    cached.map(obj => obj.fromCache.should.equal(true));
    cached.length.should.equal(10);

    const diffSort = await getAllSorted('num', 'desc');
    diffSort.map(obj => should.not.exist(obj.fromCache));
    diffSort.length.should.equal(20);
  });
});

function getAll(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).find();
}

function getAllCustomKey(ttl, key) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl, key).find();
}

function getAllSelect(ttl, ...select) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).select(select).find();
}

function getAllDistinct(ttl, distinct) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).distinct(distinct);
}

function getAllDistinctNonCached(distinct) {
  const Record = new Parse.Query(RecordObject);
  return Record.distinct(distinct);
}

function getAllNoCache() {
  const Record = new Parse.Query(RecordObject);
  return Record.find();
}

function getOne(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).greaterThan('num', 2).first();
}

function getWithSkip(skip, ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.skip(skip).cache(ttl).find();
}

function getWithLimit(limit, ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.limit(limit).cache(ttl).find();
}

function getNone(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).equalTo('notFound', true).find();
}

function getAllWithRegex(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).matches('str', /\d/).find();
}

function getNoneWithRegex(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record.cache(ttl).matches('str', /\d\d/).find();
}

function getWithUnorderedQuery(ttl) {
  const Record = new Parse.Query(RecordObject);
  getWithUnorderedQuery.flag = !getWithUnorderedQuery.flag;
  if (getWithUnorderedQuery.flag) {
    return Record.cache(ttl).exists('num').exists('str').find();
  } else {
    return Record.cache(ttl).exists('str').exists('num').find();
  }
}

function getAllSorted(sortObj, dir = 'asc') {
  const Record = new Parse.Query(RecordObject);
  const query = dir === 'asc' ? Record.ascending(sortObj) : Record.descending(sortObj);
  return query.cache(60).find();
}

function count(ttl) {
  const Record = new Parse.Query(RecordObject);
  return Record
    .cache(ttl)
    .count();
}

// function countDocuments(ttl) {
//   const Record = new Parse.Query(RecordObject);
//   return Record.find({})
//     .cache(ttl)
//     .countDocuments();
// }
//
// function estimatedDocumentCount(ttl) {
//   const Record = new Parse.Query(RecordObject);
//   return Record.find({})
//     .cache(ttl)
//     .estimatedDocumentCount();
// }
//
// function aggregate(ttl) {
//   const Record = new Parse.Query(RecordObject);
//   const pipeline = [{
//     group: { _id: null, total: { $sum: '$num' } }
//   }];
//   return Record.cache(ttl).aggregate(pipeline);
// }

let recordsCount = 0;

const generate = (amount) => {
  const records = [];
  let count = 0;
  while (count < amount) {
    records.push({
      num: count,
      str: count.toString(),
      seqNum: recordsCount,
      seqStr: recordsCount.toString()
    });
    recordsCount++;
    count++;
  }

  return Parse.Object.saveAll(records.map(r => new RecordObject(r)));
};

