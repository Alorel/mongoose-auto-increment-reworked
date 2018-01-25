// tslint:disable:no-unused-expression no-empty no-invalid-this no-duplicate-imports

import {expect} from 'chai';
import isEqual = require('lodash/isEqual');
import objectValues = require('lodash/values');
import * as mongoose from 'mongoose';
import {Document, Model} from 'mongoose';
import * as util from 'util';
import {v4} from 'uuid';
import {IdCounterDocument, MongooseAutoIncrementID, NextCountFunction, ResetCountFunction} from './index';

function inspect(value: any, opts: util.InspectOptions = {}): string {
  return util.inspect(value, Object.assign({colors: true}, opts));
}

(<any>mongoose).Promise = Promise;

const Schema = mongoose.Schema;

interface FooInterface {
  foo: number;
}

interface FooDocument extends FooInterface, Document, HasFunctions {
}

interface HasFunctions {
  _nextCount: NextCountFunction;
  _resetCount: NextCountFunction;
  nextID: NextCountFunction;
  resetID: ResetCountFunction;
}

describe('Core', () => {
  const modelMap = new Map<string | undefined, Model<IdCounterDocument>>();

  function getModel(): Model<IdCounterDocument> {
    return MongooseAutoIncrementID['idCounter'];
  }

  function cleanIdCount(): Promise<void> {
    return getModel().deleteMany({})
      .lean()
      .then(() => {
      });
  }

  function deinitialise() {
    MongooseAutoIncrementID['idCounter'] = <any>null;
  }

  function initialise(modelName?: string) {
    if (modelMap.has(modelName)) {
      MongooseAutoIncrementID['idCounter'] = <Model<IdCounterDocument>>modelMap.get(modelName);
    } else {
      deinitialise();
      MongooseAutoIncrementID.initialise(modelName);
      modelMap.set(modelName, MongooseAutoIncrementID['idCounter']);
    }
  }

  before('Connect', () => {
    const connectionOptions: any = {};

    if ((mongoose.version || '').charAt(0) === '4') {
      connectionOptions.useMongoClient = true;
    }

    return mongoose.connect('mongodb://127.0.0.1/auto-id-tests', connectionOptions);
  });

  if (!process.env.CI) { // don't need to on CI
    before('clean DB', done => {
      mongoose.connection.dropDatabase()
        .then(() => done())
        .catch(() => done());
    });

    after('clean DB', done => {
      mongoose.connection.dropDatabase()
        .then(() => done())
        .catch(() => done());
    });
  }

  before('Initialise', () => initialise());

  before('Remove id counters', () => cleanIdCount());
  after('Clean ID count', () => cleanIdCount());

  describe('static error', () => {
    let sch: mongoose.Schema;

    beforeEach(() => {
      sch = new Schema({foo: {type: String}});
    });

    it('Should return undefined if schema hasn\'t been used yet', () => {
      expect(MongooseAutoIncrementID.getErrorFor(sch, v4()))
        .to.be.undefined;
    });

    it('Should return undefined if the model hasn\'t been used yet', async() => {
      await new MongooseAutoIncrementID(sch, v4()).applyPlugin();

      expect(MongooseAutoIncrementID.getErrorFor(sch, v4()))
        .to.be.undefined;
    });

    it('Should return undefined if no errors occur', async() => {
      const name: string = v4();
      await new MongooseAutoIncrementID(sch, name).applyPlugin();

      expect(MongooseAutoIncrementID.getErrorFor(sch, name))
        .to.be.undefined;
    });

    describe('Should be the same as', () => {
      let p: MongooseAutoIncrementID;
      let name: string;
      let sch$: mongoose.Schema;
      let e: Error;
      let thrown: Error;

      before(done => {
        name = v4();
        sch$ = sch;
        p = new MongooseAutoIncrementID(sch, name);
        e = new Error('forced');
        (<any>p).init = () => Promise.reject(e);

        p.applyPlugin()
          .then(() => done('Did not throw'))
          .catch((err: Error) => {
            thrown = err;
            done();
          })
          .catch(done);
      });

      it('error in rejected applyPlugin promise', () => {
        expect(MongooseAutoIncrementID.getErrorFor(sch$, name) === thrown)
          .to.be.true;
      });

      it('active error getter', () => {
        expect(MongooseAutoIncrementID.getErrorFor(sch$, name) === p.error)
          .to.be.true;
      });
    });
  });

  describe('static promise', () => {
    let sch: mongoose.Schema;

    beforeEach(() => {
      sch = new Schema({foo: {type: String}});
    });

    it('Should return undefined if schema hasn\'t been used yet', () => {
      expect(MongooseAutoIncrementID.getPromiseFor(sch, v4()))
        .to.be.undefined;
    });

    it('Should return undefined if the model hasn\'t been used yet', async() => {
      await new MongooseAutoIncrementID(sch, v4()).applyPlugin();

      expect(MongooseAutoIncrementID.getPromiseFor(sch, v4()))
        .to.be.undefined;
    });

    describe('Should return the same promise as', () => {
      let p: MongooseAutoIncrementID;
      let p$: Promise<void>;
      let p$static: Promise<void>;

      before(() => {
        const name: string = v4();

        p = new MongooseAutoIncrementID(sch, name);
        p$ = p.applyPlugin();
        p$static = <Promise<void>>MongooseAutoIncrementID.getPromiseFor(sch, name);
      });

      it('promise returned by applyPlugin', () => {
        expect(p$static === p$).to.be.true;
      });

      it('active promise getter', () => {
        expect(p$static === p.promise).to.be.true;
      });
    });
  });

  describe('static isReady', () => {
    let sch: mongoose.Schema;

    beforeEach(() => {
      sch = new Schema({foo: {type: String}});
    });

    it('Should return false if schema hasn\'t been used yet', () => {
      expect(MongooseAutoIncrementID.isReady(sch, v4()))
        .to.be.false;
    });

    it('Should return false if the model hasn\'t been used yet', async() => {
      await new MongooseAutoIncrementID(sch, v4()).applyPlugin();

      expect(MongooseAutoIncrementID.isReady(sch, v4()))
        .to.be.false;
    });

    it('Should return true if the model initialised', async() => {
      const name: string = v4();
      const pl = new MongooseAutoIncrementID(sch, name);

      const pr$ = pl.applyPlugin();

      expect(MongooseAutoIncrementID.isReady(sch, name))
        .to.be.false;

      await pr$;

      expect(MongooseAutoIncrementID.isReady(sch, name))
        .to.be.true;
    });
  });

  describe('Constructor', () => {
    it('Should throw if schema is missing', () => {
      expect(() => new MongooseAutoIncrementID(<any>null, 'x'))
        .to.throw(TypeError, 'Schema is required and must be an instance of Mongoose Schema');
    });
    it('Should throw if schema is not an instance of Schema', () => {
      expect(() => new MongooseAutoIncrementID(<any>true, 'x'))
        .to.throw(TypeError, 'Schema is required and must be an instance of Mongoose Schema');
    });
    it('Should throw if modelName is absent', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), ''))
        .to.throw(TypeError, 'Model name must be a string');
    });
    it('Should throw if modelName is not a string', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), <any>true))
        .to.throw(TypeError, 'Model name must be a string');
    });
    it('Should succeed if all is ok', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), 'foo'))
        .not.to.throw();
    });
  });

  describe('validateOptions static', function() {
    it('should throw if no options are passed', function() {
      expect(() => MongooseAutoIncrementID['validateOptions'](<any>null))
        .to.throw(TypeError, 'Options missing');
    });
  });

  describe('initialise', () => {
    after('re-initialise', () => initialise());

    it('Should throw if already initialised', () => {
      deinitialise();
      expect(() => {
        MongooseAutoIncrementID.initialise();
        MongooseAutoIncrementID.initialise();
      })
        .to.throw(Error, 'Already initialised');
    });

    describe('Should throw if model name is', () => {
      beforeEach(() => deinitialise());

      it('Absent', () => {
        expect(() => MongooseAutoIncrementID.initialise(<any>null))
          .to.throw(TypeError, 'Model name is required');
      });
      it('Not a string', () => {
        expect(() => MongooseAutoIncrementID.initialise(<any>5))
          .to.throw(TypeError, 'Model name is required');
      });
    });

    it('Model name should default to IdCounter', () => {
      initialise();
      expect(getModel().modelName).to.eq('IdCounter');
    });

    it('Model name should be settable', () => {
      const id: string = v4();
      initialise(id);
      expect(getModel().modelName).to.eq(id);
    });
  });

  describe('Counter schema settings', () => {
    after(() => cleanIdCount());
    let doc: IdCounterDocument;

    before('Create sample doc', async() => {
      doc = await getModel().create({f: 'a', m: 'b'});
    });

    it('Should have an objectID _id', () => {
      expect(typeof doc._id).to.eq('object');
    });
    it('Should not have a virtual id', () => {
      expect(doc.id).to.be.undefined;
    });
    it('Should not have a version field', () => {
      expect(doc.__v).to.be.undefined;
    });
    it('Should not have a createdAt field', () => {
      expect(doc['createdAt']).to.be.undefined;
    });
    it('Should not have an updatedAt field', () => {
      expect(doc['updatedAt']).to.be.undefined;
    });

    it('Should have an index on f & m', async() => {
      const indices: any = objectValues(await getModel().collection.getIndexes());

      for (const index of indices) {
        if (isEqual(index, [['f', 1], ['m', 1]]) || isEqual(index, [['m', 1], ['f', 1]])) {
          return;
        }
      }

      console.log(inspect(indices));
      throw new Error('Index not found');
    });
  });

  describe('findArgs', () => {
    let name: string;
    let plugin: MongooseAutoIncrementID;

    before('init', () => {
      const sch = new Schema({foo: {type: String}});
      name = v4();
      plugin = new MongooseAutoIncrementID(sch, name, {field: 'bar'});
    });

    it('Should have a valid value', () => {
      expect(plugin['findArgs']).to.deep.eq({m: name, f: 'bar'});
    });

    it('Should be frozen', () => {
      expect(plugin['findArgs']).to.be.frozen;
    });
  });

  describe('initialStart', () => {
    let name: string;
    let plugin: MongooseAutoIncrementID;

    before('init', () => {
      const sch = new Schema({foo: {type: String}});
      name = v4();
      plugin = new MongooseAutoIncrementID(sch, name, {startAt: 5, incrementBy: 2});
    });

    it('Should eq 3', () => {
      expect(plugin['initialStart']).to.eq(3);
    });
  });

  describe('validateOptions should throw if', () => {
    let sch: mongoose.Schema;
    let opts: any;

    beforeEach(() => {
      sch = new Schema({foo: {type: String}});
      opts = {};
    });

    it('field is not a string', () => {
      opts.field = 5;
      expect(() => new MongooseAutoIncrementID(sch, v4(), opts).validateOptions())
        .to
        .throw(TypeError, 'field must be a string');
    });

    it('incrementBy is not a nuber', () => {
      opts.incrementBy = 'foo';
      expect(() => new MongooseAutoIncrementID(sch, v4(), opts).validateOptions())
        .to
        .throw(TypeError, 'incrementBy must be a number');
    });

    it('startAt is not a nuber', () => {
      opts.startAt = 'foo';
      expect(() => new MongooseAutoIncrementID(sch, v4(), opts).validateOptions())
        .to
        .throw(TypeError, 'startAt must be a number');
    });

    it('nextCount is not a string and not false', () => {
      opts.nextCount = 5;
      expect(() => new MongooseAutoIncrementID(sch, v4(), opts).validateOptions())
        .to
        .throw(TypeError, 'nextCount must be a string or false');
    });

    it('resetCount is not a string and not false', () => {
      opts.resetCount = 5;
      expect(() => new MongooseAutoIncrementID(sch, v4(), opts).validateOptions())
        .to
        .throw(TypeError, 'resetCount must be a string or false');
    });
  });

  describe('nextCount', () => {
    let mod: Model<any> & HasFunctions;

    before(() => initialise(v4()));

    before(() => {
      const sch = new Schema({foo: {type: String}});
      const name: string = v4();
      const p$ = new MongooseAutoIncrementID(sch, name).applyPlugin();
      mod = <any>mongoose.model(name, sch);

      return p$;
    });

    after(() => initialise());

    describe('Should be called _nextCount by default', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(typeof model._nextCount).to.eq('function');
      });
      it('On the instance', () => {
        expect(typeof new model()._nextCount).to.eq('function');
      });
    });
    describe('Should be undefined if false is passed', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {nextCount: false}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(model._nextCount).to.be.undefined;
      });
      it('On the instance', () => {
        expect(new model()._nextCount).to.be.undefined;
      });
    });

    describe('Should be renameable', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {nextCount: 'nextID'}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      describe('nextID should exist', () => {
        it('On the model', () => {
          expect(typeof model.nextID).to.eq('function');
        });
        it('On the instance', () => {
          expect(typeof new model().nextID).to.eq('function');
        });
      });

      describe('_nextCount should not exist', () => {
        it('On the model', () => {
          expect(model._nextCount).to.be.undefined;
        });
        it('On the instance', () => {
          expect(new model()._nextCount).to.be.undefined;
        });
      });
    });

    it('Should return 1 for the first doc', async() => {
      expect(await mod._nextCount()).to.eq(1);
    });

    it('Should return 2 for the second doc', async() => {
      await mod.create({foo: v4()});
      expect(await mod._nextCount()).to.eq(2);
    });

    it('Should return 1 if counter doc is removed', async() => {
      await cleanIdCount();
      expect(await mod._nextCount()).to.eq(1);
    });
  });

  describe('resetCount', () => {
    let mod: Model<any> & HasFunctions;

    before('initialise', () => initialise(v4()));

    before('plugin', () => {
      const sch = new Schema({foo: {type: String}});
      const name: string = v4();
      const p$ = new MongooseAutoIncrementID(sch, name).applyPlugin();
      mod = <any>mongoose.model(name, sch);

      return p$;
    });

    before('create docs', () => {
      return Promise.all([
        mod.create({foo: 'bar'}),
        mod.create({bar: 'foo'}),
        mod.create({quz: 'baz'}),
        mod.create({baz: 'qux'})
      ]);
    });

    after(() => initialise());

    it('nextCount should not return 1 initially', async() => {
      expect(await mod._nextCount()).to.not.eq(1);
    });

    it('nextCount should return 1 after resetting', async() => {
      await mod._resetCount();
      expect(await mod._nextCount()).to.eq(1);
    });

    describe('Should be called _resetCount by default', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(typeof model._resetCount).to.eq('function');
      });
      it('On the instance', () => {
        expect(typeof new model()._resetCount).to.eq('function');
      });
    });
    describe('Should be undefined if false is passed', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {resetCount: false}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(model._resetCount).to.be.undefined;
      });
      it('On the instance', () => {
        expect(new model()._resetCount).to.be.undefined;
      });
    });

    describe('Should be renameable', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {resetCount: 'resetID'}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      describe('resetID should exist', () => {
        it('On the model', () => {
          expect(typeof model.resetID).to.eq('function');
        });
        it('On the instance', () => {
          expect(typeof new model().resetID).to.eq('function');
        });
      });

      describe('_resetCount should not exist', () => {
        it('On the model', () => {
          expect(model._resetCount).to.be.undefined;
        });
        it('On the instance', () => {
          expect(new model()._resetCount).to.be.undefined;
        });
      });
    });
  });

  describe('init', () => {
    before('clear', () => cleanIdCount());

    it('Should still resolve the promise and flag itself as ready when the counter doc exists', async() => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number}});

      await getModel().create({f: '_id', m: name, c: 1});
      await new MongooseAutoIncrementID(sch, name).applyPlugin();
    });
  });

  describe('applyPlugin', () => {
    describe('should throw if not initialised', () => {
      before(() => deinitialise());
      after(() => initialise());

      it('test', done => {
        const sch = new Schema();
        const plugin = new MongooseAutoIncrementID(sch, v4());

        expect(plugin.error).to.be.undefined;

        plugin.applyPlugin()
          .then(() => done('Did not throw'))
          .catch((e: any) => {
            expect(e.message).to.eq('The initialise method has not been called');
            expect(plugin.error).to.not.be.undefined;
            done();
          })
          .catch(done);
      });
    });

    it('Should reject if an error is thrown', done => {
      const sch = new Schema();
      const plugin = new MongooseAutoIncrementID(sch, v4(), <any>{field: 5});

      expect(plugin.error).to.be.undefined;

      plugin.applyPlugin()
        .then(() => done('Did not throw'))
        .catch(() => {
          expect(plugin.error).to.not.be.undefined;
          done();
        })
        .catch(done);
    });

    it('Should set rejected to true if init rejects', done => {
      const sch = new Schema();
      const plugin = new MongooseAutoIncrementID(sch, v4());
      plugin['init'] = () => Promise.reject(new Error('I am a reject'));

      expect(plugin.error).to.be.undefined;
      plugin.applyPlugin()
        .then(() => done('no rejection'))
        .catch((e: any) => {
          expect(e.message).to.eq('I am a reject');
          expect(plugin.error).to.not.be.undefined;
          done();
        })
        .catch(done);
    });
  });

  describe('addFieldToSchema', () => {
    it('Should add a unique index if field is not _id', async() => {
      const sch = new Schema({foo: {type: Number}});
      const name: string = v4();
      const plugin = new MongooseAutoIncrementID(sch, name, {field: 'bar'});
      await plugin.applyPlugin();
      const model = mongoose.model<any>(name, sch);

      await model.create({foo: 1});

      const indices: any = await model.collection.getIndexes();
      expect(indices.bar_1).to.deep.eq([['bar', 1]]);
    });
  });

  it('Save hook should trigger even if doc is not new', async() => {
    const sch = new Schema({foo: {type: String}});
    const name: string = v4();
    const p = new MongooseAutoIncrementID(sch, name);
    await p.applyPlugin();

    const m: Model<any> = mongoose.model(name, sch);

    const d: any = await m.create({foo: 'bar'});
    expect(d._id).to.eq(1);
    d.foo = 'qux';
    await d.save();
    expect(d._id).to.eq(1);
  });

  it('Save hook should wait if plugin not ready yet', function(done) {
    const sch = new Schema({foo: {type: String}});
    const name: string = v4();
    const p = new MongooseAutoIncrementID(sch, name);
    p.applyPlugin()
      .then(async() => {
        const m: Model<any> = mongoose.model(name, sch);
        p['state'].ready = <any>false;

        setTimeout(
          () => {
            p['state'].ready = true;
          },
          50
        );

        return m.create({foo: 'bar'});

      })
      .then(() => done())
      .catch(done);
  });

  it('Save hook should fail if plugin got rejected', done => {
    const sch = new Schema({foo: {type: Number}});
    const name: string = v4();
    const p = new MongooseAutoIncrementID(sch, name);
    p.applyPlugin()
      .then(() => {
        const mod: Model<any> = mongoose.model<any>(name, sch);
        p['state'].ready = <any>false;
        p['state'].error = new Error();

        console.log(p['state']);

        mod.create({foo: 1})
          .then(() => done('Did not reject'))
          .catch((e: any) => {
            expect(e.message).to.eq('The initialisation promise rejected');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  describe('Save hook with numeric field', () => {
    let mod: Model<any> & HasFunctions;

    before(async() => {
      const name: string = v4();
      const sch = new Schema({foo: {type: String}});
      const p = new MongooseAutoIncrementID(sch, name);
      await p.applyPlugin();
      mod = <any>mongoose.model(name, sch);

      await mod.create({foo: v4()});
    });

    it('Should set counter to 5 if value > currently stored', async() => {
      await new mod({_id: 5, foo: v4()}).save();
      expect(await mod._nextCount()).to.eq(6);
    });

    it('Should not update value if value < currently stored', async() => {
      await new mod({_id: 2, foo: v4()}).save();
      expect(await mod._nextCount()).to.eq(6);
    });
  });

  describe('promise getter', function() {
    let name: string;
    let sch: mongoose.Schema;
    let p: MongooseAutoIncrementID;

    beforeEach(() => {
      name = v4();
      sch = new Schema({foo: {type: String}});
      p = new MongooseAutoIncrementID(sch, name);
    });

    it('Should be the same as the promise returned by applyPlugin', () => {
      const p$ = p.applyPlugin();
      expect(p.promise === p$).to.be.true;
    });

    it('Should be undefined until applyPlugin is called', () => {
      expect(p.promise).to.be.undefined;
    });
  });

  describe('isReady getter', function() {
    let name: string;
    let sch: mongoose.Schema;
    let p: MongooseAutoIncrementID;

    beforeEach(() => {
      name = v4();
      sch = new Schema({foo: {type: String}});
      p = new MongooseAutoIncrementID(sch, name);
    });

    it('Should be false if state.ready is false', () => {
      p['state'].ready = <any>false;
      expect(p.isReady).to.be.false;
    });

    it('Should be true if state.ready is true', () => {
      p['state'].ready = true;
      expect(p.isReady).to.be.true;
    });
  });

  describe('error getter', function() {
    let name: string;
    let sch: mongoose.Schema;
    let p: MongooseAutoIncrementID;

    beforeEach(() => {
      name = v4();
      sch = new Schema({foo: {type: String}});
      p = new MongooseAutoIncrementID(sch, name);
    });

    it('Should be undefined if no errors occurred', () => {
      expect(p.error).to.be.undefined;
    });

    it('Should be true if state.ready is true', () => {
      const e = new Error('foo');
      p['state'].error = e;
      expect(p.error === e).to.be.true;
    });
  });
});
